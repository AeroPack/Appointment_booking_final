import { AppError } from '../../utils/response.js';
import { FlowSessionRepository } from './flow.session-repository.js';
import { FlowExecutor } from './flow.executor.js';

export class FlowSessionService {
  private readonly executor: FlowExecutor;

  constructor(private readonly repo: FlowSessionRepository) {
    this.executor = new FlowExecutor(repo);
  }

  async startSession(params: {
    doctorId: string;
    patientId: string | null;
    channel: 'whatsapp' | 'web';
    channelSessionId: string;
    triggerType: string;
  }) {
    const active = await this.repo.findActiveSession(params.doctorId, params.channelSessionId);
    if (active) {
      throw new AppError(409, 'ACTIVE_SESSION_EXISTS', 'An active session already exists for this patient');
    }

    const flow = await this.repo.findPublishedFlowForDoctor(params.doctorId, params.triggerType);
    if (!flow) {
      throw new AppError(404, 'NO_PUBLISHED_FLOW', 'No published flow found for this trigger type');
    }

    const session = await this.repo.createSession({
      flowId: flow.flowId,
      flowVersionId: flow.versionId,
      doctorId: params.doctorId,
      patientId: params.patientId,
      channel: params.channel,
      channelSessionId: params.channelSessionId,
    });

    const context: Record<string, unknown> = {};
    if (params.channel === 'whatsapp' && params.channelSessionId) {
      context.patient_phone = params.channelSessionId;
    }

    const updatedSession = await this.repo.findSessionById(session.id);
    if (!updatedSession) throw new AppError(500, 'SESSION_NOT_FOUND', 'Session creation failed');

    const result = await this.executor.executeTurn(updatedSession, flow.graph);
    const messages = await this.repo.getMessages(result.id);

    return { session: result, messages };
  }

  async respondToSession(params: {
    sessionId: string;
    doctorId: string;
    channelSessionId: string;
    input: string;
  }) {
    const session = await this.repo.findSessionById(params.sessionId);
    if (!session) {
      throw new AppError(404, 'SESSION_NOT_FOUND', 'Session not found');
    }
    if (session.doctor_id !== params.doctorId) {
      throw new AppError(403, 'FORBIDDEN', 'Session does not belong to this doctor');
    }
    if (session.channel_session_id !== params.channelSessionId) {
      throw new AppError(403, 'FORBIDDEN', 'Session does not belong to this channel session');
    }

    const graph = await this.repo.getFlowGraph(session.flow_version_id);
    if (!graph) {
      throw new AppError(500, 'GRAPH_NOT_FOUND', 'Flow graph not found');
    }

    const result = await this.executor.handleInput(session, graph, params.input);
    const messages = await this.repo.getMessages(result.id);

    return { session: result, messages };
  }

  async resumeSession(params: {
    sessionId: string;
    doctorId: string;
    channelSessionId: string;
    input: string;
  }) {
    const session = await this.repo.findSessionById(params.sessionId);
    if (!session) {
      throw new AppError(404, 'SESSION_NOT_FOUND', 'Session not found');
    }
    if (session.doctor_id !== params.doctorId) {
      throw new AppError(403, 'FORBIDDEN', 'Session does not belong to this doctor');
    }

    const graph = await this.repo.getFlowGraph(session.flow_version_id);
    if (!graph) {
      throw new AppError(500, 'GRAPH_NOT_FOUND', 'Flow graph not found');
    }

    if (session.status === 'waiting_input') {
      const result = await this.executor.handleInput(session, graph, params.input);
      const messages = await this.repo.getMessages(result.id);
      return { session: result, messages };
    }

    if (session.status === 'idle') {
      const result = await this.executor.executeTurn(session, graph);
      const messages = await this.repo.getMessages(result.id);
      return { session: result, messages };
    }

    throw new AppError(400, 'INVALID_STATE', `Session is in "${session.status}" state and cannot be resumed`);
  }

  async getSession(sessionId: string) {
    const session = await this.repo.findSessionById(sessionId);
    if (!session) {
      throw new AppError(404, 'SESSION_NOT_FOUND', 'Session not found');
    }
    return session;
  }

  async getMessages(sessionId: string) {
    const session = await this.repo.findSessionById(sessionId);
    if (!session) {
      throw new AppError(404, 'SESSION_NOT_FOUND', 'Session not found');
    }
    return this.repo.getMessages(session.id);
  }

  async expireStaleSessions() {
    return this.repo.expireStaleSessions(24);
  }
}
