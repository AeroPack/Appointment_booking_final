import type { FlowGraph, FlowNodeType } from './flow.node-schemas.js';
import type { FlowSessionRow, FlowSessionRepository } from './flow.session-repository.js';
import type { InteractiveMessage } from '../../utils/channels/types.js';
import { sendMessage } from '../../utils/channels/index.js';
import { BotService } from '../bot/bot.service.js';
import { BotRepository } from '../bot/bot.repository.js';
import pool from '../../config/db.js';
import { AppError } from '../../utils/response.js';

const MAX_STEPS = 100;

/**
 * Rows offered by a slot_picker. One is spent on "show more", so a page holds
 * one fewer slot than the provider's hard cap of 10 list rows.
 */
const SLOT_PAGE_SIZE = 9;

/** Row id prefix for a bookable slot; the remainder is the ISO start time. */
const SLOT_ID_PREFIX = 'slot:';

/** Row id that pages the slot list forward. */
const SLOT_MORE_ID = 'slots:more';

/** Row id prefix for a selectable date; the remainder is YYYY-MM-DD. */
const DATE_ID_PREFIX = 'date:';

/** Row id that navigates back from time picker to date picker. */
const SLOT_BACK_ID = 'slots:back';

/** Row id prefix for a selectable venue; the remainder is the venue id. */
const VENUE_ID_PREFIX = 'venue:';

/** Row id that navigates back from date picker to venue picker. */
const VENUE_BACK_ID = 'venues:back';

/** Replace {{variable}} placeholders with values from session context. */
function interpolate(text: string, context: Record<string, unknown>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const val = context[key];
    return val !== undefined && val !== null ? String(val) : `{{${key}}}`;
  });
}

const botService = new BotService(new BotRepository());

export type NodeResult =
  | { action: 'advance'; nextNodeId: string }
  | { action: 'wait' }
  | { action: 'complete' }
  | { action: 'error'; message: string };

/** A bookable slot, pre-formatted for display. */
interface SlotOption {
  /** Offset-bearing ISO start, e.g. 2026-08-08T10:00:00+05:30. Booked as-is. */
  start: string;
  /** Owning day, YYYY-MM-DD. */
  date: string;
  /** Short day label, e.g. "Fri, 08 Aug". */
  dateLabel: string;
  /** Clock range, e.g. "10:00 AM - 10:15 AM". */
  timeLabel: string;
  /** Venue name, when the period has one. */
  venue?: string;
}

export class FlowExecutor {
  constructor(private readonly sessionRepo: FlowSessionRepository) {}

  async executeTurn(session: FlowSessionRow, graph: FlowGraph): Promise<FlowSessionRow> {
    if (session.status === 'completed' || session.status === 'error' || session.status === 'expired') {
      return session;
    }

    await this.sessionRepo.updateSessionStatus(session.id, 'running');

    let currentNodeId = session.current_node_id || this.findStartNodeId(graph);
    if (!currentNodeId) {
      await this.sessionRepo.updateSessionStatus(session.id, 'error', {
        errorMessage: 'Flow has no start node',
      });
      return { ...session, status: 'error', error_message: 'Flow has no start node' };
    }

    let context = { ...session.context };
    let stepCount = session.step_count;

    while (stepCount < MAX_STEPS) {
      const node = graph.nodes.find(n => n.id === currentNodeId);
      if (!node) {
        await this.sessionRepo.updateSessionStatus(session.id, 'error', {
          currentNodeId,
          errorMessage: `Node "${currentNodeId}" not found in graph`,
        });
        return { ...session, status: 'error', error_message: `Node "${currentNodeId}" not found in graph` };
      }

      const result = await this.handleNode(
        { ...node, type: node.type as FlowNodeType },
        graph.edges,
        context,
        session,
      );

      if (result.action === 'advance') {
        currentNodeId = result.nextNodeId;
        stepCount = await this.sessionRepo.incrementStepCount(session.id);
        continue;
      }

      if (result.action === 'wait') {
        await this.sessionRepo.updateSessionStatus(session.id, 'waiting_input', {
          currentNodeId,
          context,
        });
        return { ...session, status: 'waiting_input', current_node_id: currentNodeId, context, step_count: stepCount };
      }

      if (result.action === 'complete') {
        await this.sessionRepo.updateSessionStatus(session.id, 'completed', {
          currentNodeId,
          context,
        });
        return { ...session, status: 'completed', current_node_id: currentNodeId, context, step_count: stepCount };
      }

      if (result.action === 'error') {
        await this.sessionRepo.updateSessionStatus(session.id, 'error', {
          currentNodeId,
          errorMessage: result.message,
          context,
        });
        return { ...session, status: 'error', current_node_id: currentNodeId, error_message: result.message, context, step_count: stepCount };
      }
    }

    await this.sessionRepo.updateSessionStatus(session.id, 'error', {
      currentNodeId,
      errorMessage: `Flow exceeded maximum steps (${MAX_STEPS})`,
      context,
    });
    return { ...session, status: 'error', current_node_id: currentNodeId, error_message: `Flow exceeded maximum steps (${MAX_STEPS})`, context, step_count: stepCount };
  }

  async handleInput(session: FlowSessionRow, graph: FlowGraph, input: string): Promise<FlowSessionRow> {
    if (session.status !== 'waiting_input') {
      throw new AppError(400, 'INVALID_STATE', 'Session is not waiting for input');
    }

    const node = graph.nodes.find(n => n.id === session.current_node_id);
    if (!node) {
      await this.sessionRepo.updateSessionStatus(session.id, 'error', {
        errorMessage: `Node "${session.current_node_id}" not found`,
      });
      return { ...session, status: 'error' };
    }

    if (node.type === 'choice') {
      const resolved = this.resolveChoiceInput(input, node.data.options as Array<{ id: string; label: string; value: string }>);
      if (!resolved) {
        await this.sessionRepo.addMessage({
          sessionId: session.id,
          direction: 'outbound',
          nodeId: node.id,
          content: `Invalid selection. Please choose a valid option.\n${node.data.text}\n${(node.data.options as Array<{ label: string }>).map((o, i) => `${i + 1}. ${o.label}`).join('\n')}`,
          messageType: 'choice',
        });
        return session;
      }

      const context = { ...session.context, [node.id]: resolved.value };
      const handle = `option:${resolved.id}`;
      const edge = graph.edges.find(e => e.source === node.id && e.sourceHandle === handle);

      if (!edge) {
        await this.sessionRepo.updateSessionStatus(session.id, 'error', {
          errorMessage: `No edge found for handle "${handle}"`,
        });
        return { ...session, status: 'error' };
      }

      await this.sessionRepo.addMessage({
        sessionId: session.id,
        direction: 'inbound',
        nodeId: node.id,
        content: input,
        messageType: 'text',
      });

      session.current_node_id = edge.target;
      session.context = context;
      session.step_count = await this.sessionRepo.incrementStepCount(session.id);
      return this.executeTurn(session, graph);
    }

    if (node.type === 'slot_picker') {
      const daysAhead = Number(node.data.days_ahead ?? 7);
      const slots = await this.fetchSlots(session.doctor_id, daysAhead);
      const page = Number(session.context.slot_page ?? 0);
      const phase = session.context.slot_picker_phase || 'venue';

      await this.sessionRepo.addMessage({
        sessionId: session.id,
        direction: 'inbound',
        nodeId: node.id,
        content: input,
        messageType: 'text',
      });

      // Extract unique venues
      const venueMap = new Map<string, { id: string; name: string }>();
      for (const slot of slots) {
        if (slot.venue && !venueMap.has(slot.venue)) {
          venueMap.set(slot.venue, { id: slot.venue, name: slot.venue });
        }
      }
      const uniqueVenues = Array.from(venueMap.values());

      // If only one venue, skip to date phase
      if (uniqueVenues.length <= 1 && session.context.slot_picker_phase === undefined) {
        session.context = {
          ...session.context,
          slot_picker_phase: 'date',
          slot_selected_venue: uniqueVenues[0]?.id || null,
        };
        await this.sessionRepo.updateSessionStatus(session.id, 'running', { context: session.context });
        return this.executeTurn(session, graph);
      }

      // Phase 0: Venue selection
      if (phase === 'venue' && uniqueVenues.length > 1) {
        const trimmed = input.trim();

        if (trimmed === VENUE_BACK_ID || trimmed.toLowerCase() === 'back') {
          // Should not happen at top-level, but handle gracefully
          await this.sendOutbound(session, 'Please select a location from the list.', 'text', node.id);
          return this.executeTurn(session, graph);
        }

        // Try to parse as number (1-indexed)
        const num = parseInt(trimmed, 10);
        let selectedVenueId: string | null = null;

        if (!isNaN(num) && num >= 1 && num <= uniqueVenues.length) {
          selectedVenueId = uniqueVenues[num - 1].id;
        } else {
          // Try to match by venue id directly
          const matched = uniqueVenues.find(v => v.id === trimmed || v.name.toLowerCase() === trimmed.toLowerCase());
          if (matched) {
            selectedVenueId = matched.id;
          }
        }

        if (!selectedVenueId) {
          await this.sendOutbound(session, 'Sorry, I did not recognise that location. Please pick one of the options.', 'text', node.id);
          return this.executeTurn(session, graph);
        }

        session.context = {
          ...session.context,
          slot_picker_phase: 'date',
          slot_selected_venue: selectedVenueId,
          slot_page: 0,
        };
        await this.sessionRepo.updateSessionStatus(session.id, 'running', { context: session.context });
        return this.executeTurn(session, graph);
      }

      // Filter slots by selected venue
      const selectedVenue = session.context.slot_selected_venue as string | null;
      let filteredSlots = slots;
      if (selectedVenue) {
        filteredSlots = slots.filter(s => !s.venue || s.venue === selectedVenue);
      }

      // Phase 1: Date selection
      if (phase === 'date') {
        const dates = this.extractAvailableDates(filteredSlots);
        const weeks = this.groupDatesByWeek(dates);
        const allDateRows = weeks.flatMap(w => w.rows);
        const start = page * SLOT_PAGE_SIZE < allDateRows.length ? page * SLOT_PAGE_SIZE : 0;
        const offeredDateRows = allDateRows.slice(start, start + SLOT_PAGE_SIZE);
        const offeredDates = offeredDateRows.map(r => {
          const date = r.id.startsWith(DATE_ID_PREFIX) ? r.id.slice(DATE_ID_PREFIX.length) : '';
          return { date };
        });
        const resolved = this.resolveDateInput(input, dates, offeredDates);
        if (!resolved) {
          await this.sendOutbound(session, 'Sorry, I did not recognise that date. Please pick one of the options.', 'text', node.id);
          return this.executeTurn(session, graph);
        }

        const trimmed = input.trim();
        // Check for back to venues
        if (trimmed === VENUE_BACK_ID && uniqueVenues.length > 1) {
          session.context = {
            ...session.context,
            slot_picker_phase: 'venue',
            slot_selected_date: undefined,
            slot_page: 0,
          };
          await this.sessionRepo.updateSessionStatus(session.id, 'running', { context: session.context });
          return this.executeTurn(session, graph);
        }

        if (resolved.kind === 'more') {
          session.context = { ...session.context, slot_page: page + 1 };
          await this.sessionRepo.updateSessionStatus(session.id, 'running', { context: session.context });
          return this.executeTurn(session, graph);
        }
        session.context = {
          ...session.context,
          slot_picker_phase: 'time',
          slot_selected_date: resolved.date,
          slot_page: 0,
        };
        await this.sessionRepo.updateSessionStatus(session.id, 'running', { context: session.context });
        return this.executeTurn(session, graph);
      }

      // Phase 2: Time selection
      const selectedDate = String(session.context.slot_selected_date || '');
      const dateSlots = filteredSlots.filter(s => s.date === selectedDate);
      const TIME_PAGE_SIZE = 8;
      const timeStart = page * TIME_PAGE_SIZE < dateSlots.length ? page * TIME_PAGE_SIZE : 0;
      const offeredSlots = dateSlots.slice(timeStart, timeStart + TIME_PAGE_SIZE);
      const trimmed = input.trim();

      if (trimmed === SLOT_BACK_ID || trimmed.toLowerCase() === 'back') {
        session.context = { ...session.context, slot_picker_phase: 'date', slot_page: 0 };
        await this.sessionRepo.updateSessionStatus(session.id, 'running', { context: session.context });
        return this.executeTurn(session, graph);
      }

      const resolved = this.resolveSlotInput(input, dateSlots, offeredSlots);
      if (!resolved) {
        await this.sendOutbound(session, 'Sorry, I did not recognise that time. Please pick one of the options.', 'text', node.id);
        return this.executeTurn(session, graph);
      }

      if (resolved.kind === 'more') {
        session.context = { ...session.context, slot_page: page + 1 };
        await this.sessionRepo.updateSessionStatus(session.id, 'running', { context: session.context });
        return this.executeTurn(session, graph);
      }

      const edge = graph.edges.find(e => e.source === node.id);
      if (!edge) {
        await this.sessionRepo.updateSessionStatus(session.id, 'error', {
          errorMessage: 'Slot picker node has no outgoing edge',
        });
        return { ...session, status: 'error' };
      }

      session.current_node_id = edge.target;
      session.context = { ...session.context, slot_start: resolved.start, slot_page: 0, slot_picker_phase: undefined, slot_selected_date: undefined, slot_selected_venue: undefined };
      session.step_count = await this.sessionRepo.incrementStepCount(session.id);
      return this.executeTurn(session, graph);
    }

    if (node.type === 'input') {
      const variable = String(node.data.variable || '');
      const context = { ...session.context, [variable]: input.trim() };
      const edge = graph.edges.find(e => e.source === node.id);

      if (!edge) {
        await this.sessionRepo.updateSessionStatus(session.id, 'error', {
          errorMessage: 'Input node has no outgoing edge',
        });
        return { ...session, status: 'error' };
      }

      await this.sessionRepo.addMessage({
        sessionId: session.id,
        direction: 'inbound',
        nodeId: node.id,
        content: input,
        messageType: 'text',
      });

      session.current_node_id = edge.target;
      session.context = context;
      session.step_count = await this.sessionRepo.incrementStepCount(session.id);
      return this.executeTurn(session, graph);
    }

    if (node.type === 'api' && node.data._clientResponse !== undefined) {
      const resp = node.data._clientResponse as { status?: number; data?: unknown; error?: string };
      const apiResponse = { status: resp.status, data: resp.data, error: resp.error };
      const context = { ...session.context, api_response: apiResponse };

      const isSuccess = resp.status !== undefined && resp.status >= 200 && resp.status < 300;
      const handle = isSuccess ? 'success' : 'error';
      const edge = graph.edges.find(e => e.source === node.id && e.sourceHandle === handle);

      if (!edge) {
        const fallbackEdge = graph.edges.find(e => e.source === node.id);
        if (fallbackEdge) {
          session.current_node_id = fallbackEdge.target;
          session.context = context;
          session.step_count = await this.sessionRepo.incrementStepCount(session.id);
          return this.executeTurn(session, graph);
        }
        await this.sessionRepo.updateSessionStatus(session.id, 'error', {
          errorMessage: `No edge found for handle "${handle}" and no fallback`,
        });
        return { ...session, status: 'error' };
      }

      await this.sessionRepo.addMessage({
        sessionId: session.id,
        direction: 'inbound',
        nodeId: node.id,
        content: JSON.stringify(resp),
        messageType: 'api_response',
      });

      session.current_node_id = edge.target;
      session.context = context;
      session.step_count = await this.sessionRepo.incrementStepCount(session.id);
      return this.executeTurn(session, graph);
    }

    await this.sessionRepo.addMessage({
      sessionId: session.id,
      direction: 'inbound',
      nodeId: node.id,
      content: input,
      messageType: 'text',
    });

    return session;
  }

  private async handleNode(
    node: { id: string; type: FlowNodeType; data: Record<string, unknown> },
    edges: FlowGraph['edges'],
    context: Record<string, unknown>,
    session: FlowSessionRow,
  ): Promise<NodeResult> {
    switch (node.type) {
      case 'start':
        return this.handleStart(node, edges);
      case 'message':
        return this.handleMessage(node, edges, session);
      case 'input':
        return this.handleInputPrompt(node, session);
      case 'choice':
        return this.handleChoice(node, session);
      case 'slot_picker':
        return this.handleSlotPicker(node, context, session);
      case 'condition':
        return this.handleCondition(node, edges, context);
      case 'delay':
        return this.handleDelayNode(node, edges, session);
      case 'template':
        return this.handleTemplateNode(node, edges, session);
      case 'api':
        return this.handleApi(node, edges, session);
      case 'booking_action':
        return this.handleBookingAction(node, edges, context, session);
      case 'end':
        return this.handleEnd(node, session);
      default:
        return { action: 'error', message: `Unknown node type: ${node.type}` };
    }
  }

  private handleStart(
    node: { id: string; data: Record<string, unknown> },
    edges: FlowGraph['edges'],
  ): NodeResult {
    const edge = edges.find(e => e.source === node.id);
    if (!edge) return { action: 'error', message: 'Start node has no outgoing edge' };
    return { action: 'advance', nextNodeId: edge.target };
  }

  private async handleMessage(
    node: { id: string; data: Record<string, unknown> },
    edges: FlowGraph['edges'],
    session: FlowSessionRow,
  ): Promise<NodeResult> {
    const text = interpolate(String(node.data.text || ''), session.context);
    await this.sendOutbound(session, text, 'text', node.id);
    const edge = edges.find(e => e.source === node.id);
    if (!edge) return { action: 'complete' };
    return { action: 'advance', nextNodeId: edge.target };
  }

  private async handleInputPrompt(
    node: { id: string; data: Record<string, unknown> },
    session: FlowSessionRow,
  ): Promise<NodeResult> {
    const text = interpolate(String(node.data.text || ''), session.context);
    await this.sendOutbound(session, text, 'text', node.id);
    return { action: 'wait' };
  }

  private async handleChoice(
    node: { id: string; data: Record<string, unknown> },
    session: FlowSessionRow,
  ): Promise<NodeResult> {
    const text = interpolate(String(node.data.text || ''), session.context);
    const options = (node.data.options as Array<{ id: string; label: string; value: string }>) || [];
    const numbered = options.map((o, i) => `${i + 1}. ${o.label}`).join('\n');
    const fullText = `${text}\n\n${numbered}`;

    // The id carried back by a tap is matched by resolveChoiceInput, which
    // checks `value` before `label` - so send `value`, not the option's uuid.
    const interactive: InteractiveMessage =
      options.length <= 3
        ? {
            kind: 'buttons',
            body: text,
            buttons: options.map((o) => ({ id: o.value, title: o.label })),
          }
        : {
            kind: 'list',
            body: text,
            button: 'Choose an option',
            sections: [{ rows: options.map((o) => ({ id: o.value, title: o.label })) }],
          };

    await this.sendOutbound(session, fullText, 'choice', node.id, interactive);
    return { action: 'wait' };
  }

  /**
   * Offer real appointment slots read from the doctor's live schedule.
   *
   * Calls BotService in-process rather than going through /api/bot/slots: the
   * generic `api` node sends no auth header, and that route requires a widget
   * key it has no way to supply.
   */
  private async handleSlotPicker(
    node: { id: string; data: Record<string, unknown> },
    context: Record<string, unknown>,
    session: FlowSessionRow,
  ): Promise<NodeResult> {
    const prompt = interpolate(String(node.data.text || 'Please choose a time:'), session.context);
    const daysAhead = Number(node.data.days_ahead ?? 7);
    const page = Number(context.slot_page ?? 0);
    const phase = context.slot_picker_phase || 'venue';

    let slots: SlotOption[];
    try {
      slots = await this.fetchSlots(session.doctor_id, daysAhead);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not load slots';
      await this.sendOutbound(session, `Sorry, I could not load available times: ${msg}`, 'text', node.id);
      return { action: 'error', message: msg };
    }

    if (slots.length === 0) {
      await this.sendOutbound(
        session,
        `Sorry, there are no free appointments in the next ${daysAhead} days. Please try again later.`,
        'text',
        node.id,
      );
      return { action: 'complete' };
    }

    // Extract unique venues from slots
    const venueMap = new Map<string, { id: string; name: string }>();
    for (const slot of slots) {
      if (slot.venue && !venueMap.has(slot.venue)) {
        venueMap.set(slot.venue, { id: slot.venue, name: slot.venue });
      }
    }
    const uniqueVenues = Array.from(venueMap.values());

    // If only one venue (or no venue info), skip venue selection
    if (uniqueVenues.length <= 1) {
      context.slot_picker_phase = 'date';
      context.slot_selected_venue = uniqueVenues[0]?.id || null;
    }

    // Phase 0: Venue picker (only if multiple venues exist)
    if (phase === 'venue' && uniqueVenues.length > 1) {
      const venueRows = uniqueVenues.map(v => ({
        id: `${VENUE_ID_PREFIX}${v.id}`,
        title: v.name,
      }));

      const numbered = uniqueVenues.map((v, i) => `${i + 1}. ${v.name}`).join('\n');
      const fallback = `${prompt}\n\nWhich location would you like to visit?\n\n${numbered}\n\nReply with a number.`;
      await this.sendOutbound(session, fallback, 'choice', node.id, {
        kind: 'list',
        body: `${prompt}\n\nWhich location would you like to visit?`,
        button: 'Choose location',
        sections: [{ title: 'Available locations', rows: venueRows }],
      });
      return { action: 'wait' };
    }

    // Filter slots by selected venue if one was chosen
    const selectedVenue = context.slot_selected_venue as string | null;
    let filteredSlots = slots;
    if (selectedVenue) {
      filteredSlots = slots.filter(s => !s.venue || s.venue === selectedVenue);
    }

    if (filteredSlots.length === 0) {
      // No slots for selected venue, reset to venue selection
      if (uniqueVenues.length > 1) {
        context.slot_picker_phase = 'venue';
        context.slot_selected_venue = undefined;
        context.slot_selected_date = undefined;
        context.slot_page = 0;
        await this.sendOutbound(session, 'Sorry, there are no available times at that location. Please choose another location.', 'text', node.id);
        return { action: 'wait' };
      }
      await this.sendOutbound(
        session,
        `Sorry, there are no free appointments in the next ${daysAhead} days. Please try again later.`,
        'text',
        node.id,
      );
      return { action: 'complete' };
    }

    // Phase 1: Date picker
    if (phase === 'date') {
      const dates = this.extractAvailableDates(filteredSlots);
      const weeks = this.groupDatesByWeek(dates);
      const allDateRows = weeks.flatMap(w => w.rows);
      const start = page * SLOT_PAGE_SIZE < allDateRows.length ? page * SLOT_PAGE_SIZE : 0;
      const pageRows = allDateRows.slice(start, start + SLOT_PAGE_SIZE);
      const hasMore = allDateRows.length > start + pageRows.length;
      const sections: Array<{ title?: string; rows: Array<{ id: string; title: string; description?: string }> }> = [];
      for (const week of weeks) {
        const weekRows = pageRows.filter(r => week.rows.some(wr => wr.id === r.id));
        if (weekRows.length > 0) {
          sections.push({ title: week.title, rows: weekRows });
        }
      }
        if (hasMore) {
        sections.push({ title: 'More dates', rows: [{ id: SLOT_MORE_ID, title: 'Show more days' }] });
      }
      // Add back to venues option if multiple venues
      if (uniqueVenues.length > 1) {
        sections.push({ rows: [{ id: VENUE_BACK_ID, title: 'Back to locations' }] });
      }
      const numbered = pageRows.map((r, i) => `${i + 1}. ${r.title} -- ${r.description}`).join('\n');
      const fallback = hasMore
        ? `${prompt}\n\n${numbered}\n\nReply with a number, or MORE for more dates.`
        : `${prompt}\n\n${numbered}\n\nReply with a number.`;
      await this.sendOutbound(session, fallback, 'choice', node.id, {
        kind: 'list',
        body: prompt,
        button: 'Choose a day',
        sections,
      });
      return { action: 'wait' };
    }

    // Phase 2: Time picker for selected date
    const selectedDate = String(context.slot_selected_date || '');
    const dateSlots = filteredSlots.filter(s => s.date === selectedDate);
    if (dateSlots.length === 0) {
      context.slot_picker_phase = 'date';
      context.slot_selected_date = undefined;
      context.slot_page = 0;
      await this.sendOutbound(session, 'Sorry, no times are left for that day. Please pick another date.', 'text', node.id);
      return { action: 'wait' };
    }
    const dateLabel = dateSlots[0].dateLabel;
    const timePrompt = `Available times for ${dateLabel}:`;
    const TIME_PAGE_SIZE = 8;
    const timeStart = page * TIME_PAGE_SIZE < dateSlots.length ? page * TIME_PAGE_SIZE : 0;
    const pageSlots = dateSlots.slice(timeStart, timeStart + TIME_PAGE_SIZE);
    const hasMore = dateSlots.length > timeStart + pageSlots.length;
    const timeRows = pageSlots.map(s => ({
      id: `${SLOT_ID_PREFIX}${s.start}`,
      title: s.timeLabel,
      ...(s.venue ? { description: s.venue } : {}),
    }));
    if (hasMore) {
      timeRows.push({ id: SLOT_MORE_ID, title: 'Show more times' });
    } else {
      timeRows.push({ id: SLOT_BACK_ID, title: 'Back to dates' });
    }
    const sections = [{ title: 'Available times', rows: timeRows }];
    const numbered = pageSlots.map((s, i) => `${i + 1}. ${s.timeLabel}`).join('\n');
    const moreOrBack = hasMore ? 'MORE for more times' : 'BACK to choose a different date';
    const fallback = `${timePrompt}\n\n${numbered}\n\nReply with a number, or ${moreOrBack}.`;
    await this.sendOutbound(session, fallback, 'choice', node.id, {
      kind: 'list',
      body: timePrompt,
      button: 'View times',
      sections,
    });
    return { action: 'wait' };
  }

  /**
   * Read the doctor's free slots for the next N days, soonest first.
   * @param doctorId - Doctor whose schedule to read
   * @param daysAhead - How many days of schedule to consider
   * @returns Bookable slots, full ones excluded
   */
  private async fetchSlots(doctorId: string, daysAhead: number): Promise<SlotOption[]> {
    const today = new Date();
    const from = this.formatDate(today);
    const to = this.formatDate(new Date(today.getTime() + (daysAhead - 1) * 86400000));

    const result = await botService.getSlots({ doctor_id: doctorId, from, to });

    const out: SlotOption[] = [];
    for (const day of result.days) {
      for (const slot of day.slots) {
        if (slot.is_full) continue;
        out.push({
          start: slot.start,
          date: day.date,
          dateLabel: this.formatDateLabel(day.date),
          timeLabel: `${this.formatClock(slot.start)} - ${this.formatClock(slot.end)}`,
          venue: slot.venue?.name,
        });
      }
    }
    return out;
  }

  /**
   * Group slots into one list section per date, so a patient scanning the
   * picker can tell Friday's 10:00 from Saturday's.
   * @param slots - Slots for the current page, in chronological order
   * @returns List sections ready for the channel
   */
  private groupSlotsByDate(
    slots: SlotOption[],
  ): Array<{ title?: string; rows: Array<{ id: string; title: string; description?: string }> }> {
    const sections: Array<{ title?: string; rows: Array<{ id: string; title: string; description?: string }> }> = [];

    for (const slot of slots) {
      const row = {
        id: `${SLOT_ID_PREFIX}${slot.start}`,
        title: slot.timeLabel,
        ...(slot.venue ? { description: slot.venue } : {}),
      };
      const last = sections[sections.length - 1];
      if (last && last.title === slot.dateLabel) {
        last.rows.push(row);
      } else {
        sections.push({ title: slot.dateLabel, rows: [row] });
      }
    }

    return sections;
  }

  /**
   * Resolve a reply to a slot_picker into either a chosen slot or a page turn.
   * @param input - Raw patient input (a row id, or typed text)
   * @param slots - The slots currently on offer, in display order
   * @returns What the patient meant
   */
  private resolveSlotInput(
    input: string,
    available: SlotOption[],
    offered: SlotOption[],
  ): { kind: 'slot'; start: string } | { kind: 'more' } | null {
    const trimmed = input.trim();

    if (trimmed === SLOT_MORE_ID || trimmed.toLowerCase() === 'more') {
      return { kind: 'more' };
    }

    // Checked against every free slot, not just the page on screen: WhatsApp
    // leaves older list messages tappable in the chat history, so a patient
    // can scroll up and pick from a list we sent several turns ago. Rejecting
    // a slot that is genuinely free would be wrong.
    if (trimmed.startsWith(SLOT_ID_PREFIX)) {
      const start = trimmed.slice(SLOT_ID_PREFIX.length);
      return available.some((s) => s.start === start) ? { kind: 'slot', start } : null;
    }

    // A typed ordinal is relative to the page just shown, so it resolves
    // against `offered` rather than the full list.
    const num = parseInt(trimmed, 10);
    if (!isNaN(num) && num >= 1 && num <= offered.length) {
      return { kind: 'slot', start: offered[num - 1].start };
    }

    return null;
  }

  /**
   * Extract unique dates from a flat slot list, counting free slots per day.
   */
  extractAvailableDates(slots: SlotOption[]) {
    const map = new Map<string, { dateLabel: string; count: number }>();
    for (const slot of slots) {
      const existing = map.get(slot.date);
      if (existing) {
        existing.count++;
      } else {
        map.set(slot.date, { dateLabel: slot.dateLabel, count: 1 });
      }
    }
    return Array.from(map.entries()).map(([date, { dateLabel, count }]) => ({
      date,
      dateLabel,
      slotCount: count,
    }));
  }

  /**
   * Group dates into week sections like "1 week (14 Aug to 16 Aug)".
   */
  groupDatesByWeek(dates: Array<{ date: string; dateLabel: string; slotCount: number }>) {
    if (dates.length === 0) return [];
    const weeks: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }> = [];
    let currentWeek: { title: string; rows: Array<{ id: string; title: string; description?: string }> } | null = null;
    let weekNum = 0;
    let lastMonday: Date | null = null;
    for (const d of dates) {
      const dateObj = new Date(`${d.date}T00:00:00+05:30`);
      const day = dateObj.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const monday = new Date(dateObj);
      monday.setDate(monday.getDate() + diff);
      if (!lastMonday || monday.getTime() !== lastMonday.getTime()) {
        weekNum++;
        const sunday = new Date(monday);
        sunday.setDate(sunday.getDate() + 6);
        const fmtShort = (dt: Date) => dt.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' });
        currentWeek = {
          title: `${weekNum} week (${fmtShort(monday)} to ${fmtShort(sunday)})`,
          rows: [],
        };
        weeks.push(currentWeek);
        lastMonday = monday;
      }
      currentWeek!.rows.push({
        id: `${DATE_ID_PREFIX}${d.date}`,
        title: d.dateLabel,
        description: `${d.slotCount} slot${d.slotCount > 1 ? 's' : ''}`,
      });
    }
    return weeks;
  }

  /**
   * Resolve a reply to the date picker into either a chosen date or a page turn.
   */
  resolveDateInput(
    input: string,
    availableDates: Array<{ date: string; dateLabel: string; slotCount: number }>,
    offeredDates: Array<{ date: string }>,
  ): { kind: 'date'; date: string } | { kind: 'more' } | null {
    const trimmed = input.trim();
    if (trimmed === SLOT_MORE_ID || trimmed.toLowerCase() === 'more') {
      return { kind: 'more' };
    }
    if (trimmed.startsWith(DATE_ID_PREFIX)) {
      const date = trimmed.slice(DATE_ID_PREFIX.length);
      return availableDates.some(d => d.date === date) ? { kind: 'date', date } : null;
    }
    const num = parseInt(trimmed, 10);
    if (!isNaN(num) && num >= 1 && num <= offeredDates.length) {
      return { kind: 'date', date: offeredDates[num - 1].date };
    }
    return null;
  }

  /**
   * Render "2026-08-08" as a short day label in clinic-local time.
   * @param dateStr - Date in YYYY-MM-DD
   * @returns Something like "Fri, 08 Aug"
   */
  private formatDateLabel(dateStr: string): string {
    return new Date(`${dateStr}T00:00:00+05:30`).toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });
  }

  /**
   * Render an offset-bearing ISO timestamp as a clinic-local clock time.
   * @param iso - Timestamp such as 2026-08-08T10:00:00+05:30
   * @returns Something like "10:00 AM"
   */
  private formatClock(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  private handleCondition(
    node: { id: string; data: Record<string, unknown> },
    edges: FlowGraph['edges'],
    context: Record<string, unknown>,
  ): NodeResult {
    const variable = String(node.data.variable || '');
    const operator = String(node.data.operator || 'equals');
    const value = node.data.value !== undefined ? String(node.data.value) : undefined;

    const actual = context[variable];
    const result = this.evaluateCondition(actual, operator, value);
    const handle = result ? 'true' : 'false';
    const edge = edges.find(e => e.source === node.id && e.sourceHandle === handle);

    if (!edge) return { action: 'error', message: `Condition node missing "${handle}" branch` };
    return { action: 'advance', nextNodeId: edge.target };
  }

  private async handleApi(
    node: { id: string; data: Record<string, unknown> },
    edges: FlowGraph['edges'],
    session: FlowSessionRow,
  ): Promise<NodeResult> {
    const url = String(node.data.url || '');
    const method = (node.data.method as string) || 'GET';

    try {
      const axios = (await import('axios')).default;
      const response = await axios({
        method: method.toLowerCase() as 'get' | 'post',
        url,
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' },
      });

      const apiResponse = { status: response.status, data: response.data };
      const contextKey = `api_response`;
      const context = { [contextKey]: apiResponse };

      const edge = edges.find(e => e.source === node.id && e.sourceHandle === 'success');
      if (!edge) {
        const fallback = edges.find(e => e.source === node.id);
        if (fallback) return { action: 'advance', nextNodeId: fallback.target };
        return { action: 'error', message: 'API node has no outgoing edge' };
      }

      await this.sessionRepo.addMessage({
        sessionId: session.id,
        direction: 'outbound',
        nodeId: node.id,
        content: JSON.stringify(apiResponse),
        messageType: 'api_response',
      });

      Object.assign(session.context, context);
      return { action: 'advance', nextNodeId: edge.target };
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      const apiResponse = { error };
      const context = { api_response: apiResponse };

      const edge = edges.find(e => e.source === node.id && e.sourceHandle === 'error');
      if (!edge) {
        const fallback = edges.find(e => e.source === node.id);
        if (fallback) {
          Object.assign(session.context, context);
          return { action: 'advance', nextNodeId: fallback.target };
        }
        return { action: 'error', message: `API call failed: ${error}` };
      }

      await this.sessionRepo.addMessage({
        sessionId: session.id,
        direction: 'outbound',
        nodeId: node.id,
        content: JSON.stringify(apiResponse),
        messageType: 'api_response',
      });

      Object.assign(session.context, context);
      return { action: 'advance', nextNodeId: edge.target };
    }
  }

  private async handleBookingAction(
    node: { id: string; data: Record<string, unknown> },
    edges: FlowGraph['edges'],
    context: Record<string, unknown>,
    session: FlowSessionRow,
  ): Promise<NodeResult> {
    const required = ['patient_name', 'patient_phone', 'slot_start'];
    const missing = required.filter(k => !context[k] || String(context[k]).trim() === '');

    if (missing.length > 0) {
      const msg = `Missing required information: ${missing.join(', ')}`;
      await this.sendOutbound(session, msg, 'text', node.id);
      return { action: 'error', message: msg };
    }

    try {
      const doctorId = session.doctor_id;
      const clinicId = await this.sessionRepo.findDoctorClinicId(doctorId);
      if (!clinicId) throw new Error('Doctor not associated with any clinic');

      const scheduledStart = new Date(String(context.slot_start));
      if (isNaN(scheduledStart.getTime()) || scheduledStart <= new Date()) {
        throw new Error('Invalid or past slot_start');
      }

      const ist = this.toIST(scheduledStart);
      const slotMin = ist.hours * 60 + ist.minutes;

      // Build query with optional venue filter
      const selectedVenueId = context.slot_selected_venue as string | null;
      let settingsQuery = `
        SELECT s.*, v.name AS venue_name
        FROM appointment_settings s
        LEFT JOIN venues v ON v.id = s.venue_id
        WHERE s.doctor_id = $1 AND s.day_of_week = $2 AND s.is_active = true
      `;
      const params: unknown[] = [doctorId, ist.dayOfWeek];
      
      if (selectedVenueId) {
        settingsQuery += ` AND s.venue_id = $3`;
        params.push(selectedVenueId);
      }
      
      settingsQuery += ` ORDER BY s.start_time`;
      
      const settingsResult = await pool.query(settingsQuery, params);
      const periods = settingsResult.rows;
      if (periods.length === 0) throw new Error('Doctor has no active settings for this day');

      const matching = periods.find((p: Record<string, unknown>) => {
        const start = this.toMinutes(String(p.start_time));
        const end = this.toMinutes(String(p.end_time));
        return slotMin >= start && (slotMin + Number(p.slot_duration_minutes)) <= end;
      });
      if (!matching) throw new Error('Slot does not fall within an active period');

      const periodStart = this.toMinutes(String(matching.start_time));
      if ((slotMin - periodStart) % Number(matching.slot_duration_minutes) !== 0) {
        throw new Error('Slot time must align with the slot grid');
      }

      const scheduledEnd = new Date(scheduledStart.getTime() + Number(matching.slot_duration_minutes) * 60 * 1000);

      const bookedResult = await pool.query(
        `SELECT COUNT(*)::int AS count FROM appointments
         WHERE doctor_id = $1 AND scheduled_start >= $2 AND scheduled_start < $3
         AND appointment_status IN ('booked', 'finished') AND deleted_at IS NULL`,
        [doctorId, scheduledStart, scheduledEnd]
      );
      if (bookedResult.rows[0].count >= Number(matching.max_patients_per_slot)) {
        throw new Error('This slot is fully booked');
      }

      let patientResult = await pool.query(
        `SELECT id, name FROM users WHERE mobile_number = $1 AND role = 'patient' AND deleted_at IS NULL LIMIT 1`,
        [String(context.patient_phone)]
      );
      let patientId: string;
      if (patientResult.rows[0]) {
        patientId = patientResult.rows[0].id;
      } else {
        patientResult = await pool.query(
          `INSERT INTO users (name, mobile_number, clinic_id, role) VALUES ($1, $2, $3, 'patient') RETURNING id`,
          [String(context.patient_name), String(context.patient_phone), clinicId]
        );
        patientId = patientResult.rows[0].id;
      }

      const dateStr = this.formatDate(scheduledStart);
      const tokenResult = await pool.query(
        `SELECT COALESCE(MAX(token_number), 0) + 1 AS next FROM appointments
         WHERE doctor_id = $1 AND (scheduled_start AT TIME ZONE 'Asia/Kolkata')::date = $2`,
        [doctorId, dateStr]
      );
      const tokenNumber = tokenResult.rows[0].next;

      const idempotencyKey = `flow:${session.id}:${node.id}`;
      const existing = await pool.query(
        `SELECT appointment_id FROM booking_idempotency WHERE idempotency_key = $1`,
        [idempotencyKey]
      );
      if (existing.rows[0]) {
        const apptResult = await pool.query(
          `SELECT id, token_number, scheduled_start, scheduled_end FROM appointments WHERE id = $1`,
          [existing.rows[0].appointment_id]
        );
        const appt = apptResult.rows[0];
        const appointment = {
          appointment_id: appt.id,
          token_number: appt.token_number,
          scheduled_start: appt.scheduled_start,
          scheduled_end: appt.scheduled_end,
        };
        context.appointment = appointment;
        const edge = edges.find(e => e.source === node.id);
        if (edge) return { action: 'advance', nextNodeId: edge.target };
        return { action: 'complete' };
      }

      const insertResult = await pool.query(
        `INSERT INTO appointments (clinic_id, doctor_id, patient_id, booked_by_user_id, venue_id, scheduled_start, scheduled_end, token_number, appointment_type, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [
          clinicId, doctorId, patientId, doctorId,
          matching.venue_id || null, scheduledStart, scheduledEnd,
          tokenNumber, context.appointment_type || 'checkup',
          context.reason || null,
        ]
      );
      const appointmentId = insertResult.rows[0].id;

      await pool.query(
        `INSERT INTO booking_idempotency (idempotency_key, appointment_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [idempotencyKey, appointmentId]
      );

      const doctorInfoResult = await pool.query(
        `SELECT name FROM users WHERE id = $1`,
        [doctorId]
      );

      const appointment = {
        appointment_id: appointmentId,
        token_number: tokenNumber,
        scheduled_start: scheduledStart.toISOString(),
        scheduled_end: scheduledEnd.toISOString(),
        doctor_name: doctorInfoResult.rows[0]?.name || 'Doctor',
        patient_name: String(context.patient_name),
      };

      context.appointment = appointment;

      // Patient-facing, so render in clinic-local time. The raw ISO instant
      // stays on the `appointment` context object for downstream nodes.
      const confirmMsg =
        `Your appointment is scheduled for ${this.formatDateLabel(this.formatDate(scheduledStart))}, ` +
        `${this.formatClock(scheduledStart.toISOString())} - ${this.formatClock(scheduledEnd.toISOString())}.\n` +
        `Doctor: ${appointment.doctor_name}\n` +
        `Token: #${tokenNumber}\n\n` +
        `Thank you, ${appointment.patient_name}!`;
      await this.sendOutbound(session, confirmMsg, 'text', node.id);

      const edge = edges.find(e => e.source === node.id);
      if (edge) return { action: 'advance', nextNodeId: edge.target };
      return { action: 'complete' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Booking failed';
      context.booking_error = msg;
      await this.sendOutbound(session, `Booking failed: ${msg}`, 'text', node.id);
      return { action: 'error', message: msg };
    }
  }

  private async handleEnd(
    node: { id: string; data: Record<string, unknown> },
    session: FlowSessionRow,
  ): Promise<NodeResult> {
    if (node.data.message) {
      const text = interpolate(String(node.data.message), session.context);
      await this.sendOutbound(session, text, 'text', node.id);
    }
    return { action: 'complete' };
  }

  private evaluateCondition(
    actual: unknown,
    operator: string,
    expected: string | undefined,
  ): boolean {
    const str = actual !== undefined && actual !== null ? String(actual) : '';
    switch (operator) {
      case 'equals': return str === (expected || '');
      case 'not_equals': return str !== (expected || '');
      case 'contains': return str.includes(expected || '');
      case 'exists': return actual !== undefined && actual !== null && actual !== '';
      default: return false;
    }
  }

  private async handleTemplateNode(
    node: { id: string; data: Record<string, unknown> },
    edges: FlowGraph['edges'],
    session: FlowSessionRow,
  ): Promise<NodeResult> {
    const templateId = String(node.data.template_id || '');
    if (!templateId) {
      return { action: 'error', message: 'Template node has no template_id' };
    }

    const template = await this.sessionRepo.findTemplateById(templateId);
    if (!template) {
      return { action: 'error', message: `Template "${templateId}" not found` };
    }

    const text = this.renderTemplateContent(template.content, session.context);
    await this.sendOutbound(session, text, 'text', node.id);

    const edge = edges.find(e => e.source === node.id);
    if (!edge) return { action: 'complete' };
    return { action: 'advance', nextNodeId: edge.target };
  }

  private async handleDelayNode(
    node: { id: string; data: Record<string, unknown> },
    edges: FlowGraph['edges'],
    session: FlowSessionRow,
  ): Promise<NodeResult> {
    const offsetMinutes = Number(node.data.offset_minutes || 0);
    const offsetFrom = String(node.data.offset_from || 'appointment_start');

    const appointmentStart = session.context.appointment
      ? new Date(String((session.context.appointment as Record<string, unknown>).scheduled_start))
      : null;

    if (!appointmentStart || isNaN(appointmentStart.getTime())) {
      return { action: 'error', message: 'Delay node requires a booked appointment with scheduled_start in context' };
    }

    const offsetMs = offsetMinutes * 60 * 1000;
    const executeAt = offsetFrom === 'appointment_end'
      ? new Date(appointmentStart.getTime() + offsetMs)
      : new Date(appointmentStart.getTime() - offsetMs);

    if (executeAt <= new Date()) {
      const edge = edges.find(e => e.source === node.id);
      if (!edge) return { action: 'complete' };
      return { action: 'advance', nextNodeId: edge.target };
    }

    const edge = edges.find(e => e.source === node.id);
    const nextNodeId = edge?.target;

    if (!nextNodeId) {
      return { action: 'error', message: 'Delay node has no outgoing edge' };
    }

    await this.sessionRepo.insertScheduledExecution({
      sessionId: session.id,
      flowId: session.flow_id,
      flowVersionId: session.flow_version_id,
      doctorId: session.doctor_id,
      patientId: session.patient_id,
      appointmentId: session.context.appointment
        ? String((session.context.appointment as Record<string, unknown>).appointment_id)
        : null,
      currentNodeId: nextNodeId,
      context: session.context,
      executeAt,
    });

    await this.sendOutbound(
      session,
      `[Flow paused - will resume at ${executeAt.toLocaleString()}]`,
      'text',
      node.id,
    );

    return { action: 'complete' };
  }

  private renderTemplateContent(content: string, context: Record<string, unknown>): string {
    return content.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
      const val = context[key];
      if (val !== undefined && val !== null) return String(val);
      if (context.appointment) {
        const appt = context.appointment as Record<string, unknown>;
        if (appt[key] !== undefined && appt[key] !== null) return String(appt[key]);
      }
      return `{{${key}}}`;
    });
  }

  private resolveChoiceInput(
    input: string,
    options: Array<{ id: string; label: string; value: string }>,
  ): { id: string; label: string; value: string } | null {
    const trimmed = input.trim();

    const num = parseInt(trimmed, 10);
    if (!isNaN(num) && num >= 1 && num <= options.length) {
      return options[num - 1];
    }

    const lower = trimmed.toLowerCase();
    for (const opt of options) {
      if (opt.value.toLowerCase() === lower) return opt;
    }
    for (const opt of options) {
      if (opt.label.toLowerCase() === lower) return opt;
    }

    return null;
  }

  private findStartNodeId(graph: FlowGraph): string | null {
    const startNode = graph.nodes.find(n => n.type === 'start');
    return startNode?.id || null;
  }

  /**
   * Record an outbound message and, on WhatsApp, deliver it.
   *
   * @param session - Session being advanced
   * @param content - Plain-text rendering. Always required: it is what the web
   *                  widget shows, what the transcript stores, and the fallback
   *                  for providers that cannot render `interactive`.
   * @param messageType - Transcript classification
   * @param nodeId - Node that produced the message
   * @param interactive - Optional richer rendering (buttons / list picker)
   */
  private async sendOutbound(
    session: FlowSessionRow,
    content: string,
    messageType: 'text' | 'choice',
    nodeId: string,
    interactive?: InteractiveMessage,
  ): Promise<void> {
    await this.sessionRepo.addMessage({
      sessionId: session.id,
      direction: 'outbound',
      nodeId,
      content,
      messageType,
    });

    if (session.channel === 'whatsapp' && session.channel_session_id) {
      const clinicId = await this.sessionRepo.findDoctorClinicId(session.doctor_id);
      if (clinicId) {
        try {
          await sendMessage({
            to: session.channel_session_id,
            content,
            clinicId,
            channel: 'whatsapp',
            options: {
              ...(interactive ? { interactive } : {}),
              doctorId: session.doctor_id,
            },
          });
        } catch (err) {
          console.error('[FlowExecutor] Failed to send WhatsApp message:', err);
        }
      }
    }
  }

  private toIST(date: Date): { hours: number; minutes: number; dayOfWeek: number } {
    const utc = date.getTime() + date.getTimezoneOffset() * 60000;
    const ist = new Date(utc + 5.5 * 3600000);
    return {
      hours: ist.getHours(),
      minutes: ist.getMinutes(),
      dayOfWeek: ((ist.getDay() + 6) % 7) + 1,
    };
  }

  private toMinutes(timeStr: string): number {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  }

  private formatDate(date: Date): string {
    const ist = new Date(date.getTime() + 5.5 * 3600000);
    return ist.toISOString().split('T')[0];
  }
}
