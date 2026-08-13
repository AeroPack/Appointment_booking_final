import axios, { AxiosError } from 'axios';
import pool from '../../config/db.js';
import { AppError } from '../../utils/response.js';

interface EvolutionCredentials {
  apiUrl: string;
  apiKey: string;
}

interface InstanceInfo {
  instanceName: string;
  status: 'disconnected' | 'connecting' | 'connected';
  qrcode?: string;
}

export class EvolutionService {
  private getCredentials(): EvolutionCredentials {
    const apiUrl = process.env['EVOLUTION_API_URL'];
    const apiKey = process.env['EVOLUTION_API_KEY'];

    if (!apiUrl || !apiKey) {
      throw new AppError(500, 'EVOLUTION_NOT_CONFIGURED', 'Evolution API is not configured');
    }

    return { apiUrl, apiKey };
  }

  private headers(apiKey: string) {
    return { apikey: apiKey, 'Content-Type': 'application/json' };
  }

  async connectDoctor(doctorId: string, phoneNumber: string): Promise<InstanceInfo> {
    const { apiUrl, apiKey } = this.getCredentials();
    const instanceName = this.getInstanceName(doctorId);

    const existing = await this.getStatusFromDb(doctorId);
    if (existing && existing.status === 'connected') {
      return { instanceName: existing.instanceName, status: 'connected' };
    }

    const payload = {
      instanceName,
      number: phoneNumber,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true,
      reject_call: false,
      always_online: true,
    };

    const webhookUrl = `${process.env['BACKEND_URL'] || 'http://localhost:3000'}/api/webhooks/whatsapp-evolution/${instanceName}`;

    try {
      await axios.post(`${apiUrl}/instance/create`, payload, {
        headers: this.headers(apiKey),
        timeout: 30000,
      });

      // Set webhook explicitly (create endpoint may not accept it)
      await axios.post(`${apiUrl}/webhook/set/${instanceName}`, {
        webhook: {
          enabled: true,
          url: webhookUrl,
          by_events: false,
          events: ['MESSAGES_UPSERT'],
        },
      }, {
        headers: this.headers(apiKey),
        timeout: 10000,
      });
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 403) {
        console.log(`[EvolutionService] Instance ${instanceName} exists, deleting and recreating...`);
        try {
          await axios.delete(`${apiUrl}/instance/delete/${instanceName}`, {
            headers: this.headers(apiKey),
            timeout: 10000,
          });
          await axios.post(`${apiUrl}/instance/create`, payload, {
            headers: this.headers(apiKey),
            timeout: 30000,
          });
          // Set webhook after recreation
          await axios.post(`${apiUrl}/webhook/set/${instanceName}`, {
            webhook: {
              enabled: true,
              url: webhookUrl,
              by_events: false,
              events: ['MESSAGES_UPSERT'],
            },
          }, {
            headers: this.headers(apiKey),
            timeout: 10000,
          });
        } catch (retryErr) {
          console.error('[EvolutionService] Error recreating instance:', retryErr);
          if (retryErr instanceof AxiosError) {
            const msg = retryErr.response?.data?.message || retryErr.message;
            throw new AppError(502, 'EVOLUTION_API_ERROR', `Failed to recreate instance: ${msg}`);
          }
          throw retryErr;
        }
      } else {
        console.error('[EvolutionService] Error creating instance:', error);
        if (error instanceof AxiosError) {
          const msg = error.response?.data?.message || error.message;
          throw new AppError(502, 'EVOLUTION_API_ERROR', `Failed to create instance: ${msg}`);
        }
        throw error;
      }
    }

    await this.updateDb(doctorId, instanceName, 'connecting');
    return { instanceName, status: 'connecting' };
  }

  async getQrCode(doctorId: string): Promise<InstanceInfo> {
    const { apiUrl, apiKey } = this.getCredentials();
    const instanceName = this.getInstanceName(doctorId);

    const dbStatus = await this.getStatusFromDb(doctorId);
    if (dbStatus?.status === 'connected') {
      return { instanceName, status: 'connected' };
    }

    if (!dbStatus) {
      return { instanceName, status: 'disconnected' };
    }

    try {
      // 1. Check connection state
      const stateResp = await axios.get(
        `${apiUrl}/instance/connectionState/${instanceName}`,
        { headers: this.headers(apiKey), timeout: 10000 }
      );

      const state = stateResp.data?.instance?.state;

      if (state === 'open') {
        await this.updateDb(doctorId, instanceName, 'connected');
        return { instanceName, status: 'connected' };
      }

      if (state === 'close') {
        await this.updateDb(doctorId, instanceName, 'disconnected');
        return { instanceName, status: 'disconnected' };
      }

      // 2. Instance is connecting - get QR from /instance/connect/ endpoint
      const connectResp = await axios.get(
        `${apiUrl}/instance/connect/${instanceName}`,
        { headers: this.headers(apiKey), timeout: 10000 }
      );

      const base64 = connectResp.data?.base64;
      const normalized = base64
        ? base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`
        : undefined;

      return { instanceName, status: 'connecting', qrcode: normalized };
    } catch {
      return { instanceName, status: 'disconnected' };
    }
  }

  async getStatus(doctorId: string): Promise<InstanceInfo> {
    const { apiUrl, apiKey } = this.getCredentials();
    const instanceName = this.getInstanceName(doctorId);

    const dbStatus = await this.getStatusFromDb(doctorId);
    if (!dbStatus) {
      return { instanceName, status: 'disconnected' };
    }

    if (dbStatus.status === 'connected') {
      try {
        const resp = await axios.get(
          `${apiUrl}/instance/connectionState/${instanceName}`,
          { headers: this.headers(apiKey), timeout: 10000 }
        );
        if (resp.data?.instance?.state === 'open') {
          return { instanceName, status: 'connected' };
        }
        await this.updateDb(doctorId, instanceName, 'disconnected');
        return { instanceName, status: 'disconnected' };
      } catch {
        return { instanceName, status: dbStatus.status as InstanceInfo['status'] };
      }
    }

    // If DB says "connecting" but the Evolution instance is closed,
    // the connect flow timed out. Reset to disconnected.
    if (dbStatus.status === 'connecting') {
      try {
        const resp = await axios.get(
          `${apiUrl}/instance/connectionState/${instanceName}`,
          { headers: this.headers(apiKey), timeout: 10000 }
        );
        const state = resp.data?.instance?.state;
        if (state === 'open') {
          await this.updateDb(doctorId, instanceName, 'connected');
          return { instanceName, status: 'connected' };
        }
        // Instance closed = truly failed, reset
        if (state === 'close') {
          await this.updateDb(doctorId, instanceName, 'disconnected');
          return { instanceName, status: 'disconnected' };
        }
        // Still initializing (connecting state) - return connecting so frontend keeps polling QR
        return { instanceName, status: 'connecting' };
      } catch {
        await this.updateDb(doctorId, instanceName, 'disconnected');
        return { instanceName, status: 'disconnected' };
      }
    }

    return { instanceName, status: dbStatus.status as InstanceInfo['status'] };
  }

  async disconnectDoctor(doctorId: string): Promise<void> {
    const { apiUrl, apiKey } = this.getCredentials();
    const instanceName = this.getInstanceName(doctorId);

    try {
      await axios.delete(`${apiUrl}/instance/delete/${instanceName}`, {
        headers: this.headers(apiKey),
        timeout: 10000,
      });
    } catch (error) {
      console.error('[EvolutionService] Error deleting instance:', error);
    }

    await pool.query(
      `UPDATE doctor_chatbot_config
       SET evolution_instance_name = NULL,
           evolution_connection_status = 'disconnected',
           evolution_connected_at = NULL,
           updated_at = NOW()
       WHERE doctor_id = $1`,
      [doctorId]
    );
  }

  private getInstanceName(doctorId: string): string {
    return `evo-${doctorId.substring(0, 8)}`;
  }

  private async getStatusFromDb(
    doctorId: string
  ): Promise<{ instanceName: string; status: string } | null> {
    const result = await pool.query(
      `SELECT evolution_instance_name, evolution_connection_status
       FROM doctor_chatbot_config
       WHERE doctor_id = $1`,
      [doctorId]
    );

    if (result.rows.length === 0 || !result.rows[0].evolution_instance_name) {
      return null;
    }

    return {
      instanceName: result.rows[0].evolution_instance_name,
      status: result.rows[0].evolution_connection_status,
    };
  }

  private async updateDb(
    doctorId: string,
    instanceName: string,
    status: string
  ): Promise<void> {
    await pool.query(
      `INSERT INTO doctor_chatbot_config (doctor_id, evolution_instance_name, evolution_connection_status, is_enabled, updated_at)
       VALUES ($1, $2, $3, true, NOW())
       ON CONFLICT (doctor_id) DO UPDATE SET
         evolution_instance_name = EXCLUDED.evolution_instance_name,
         evolution_connection_status = EXCLUDED.evolution_connection_status,
         evolution_connected_at = CASE
           WHEN EXCLUDED.evolution_connection_status = 'connected' THEN NOW()
           ELSE doctor_chatbot_config.evolution_connected_at
         END,
         is_enabled = true,
         updated_at = NOW()`,
      [doctorId, instanceName, status]
    );
  }

  async getDoctorIdByInstance(instanceName: string): Promise<string | null> {
    const result = await pool.query(
      `SELECT doctor_id FROM doctor_chatbot_config
       WHERE evolution_instance_name = $1`,
      [instanceName]
    );
    return result.rows[0]?.doctor_id ?? null;
  }
}

export const evolutionService = new EvolutionService();
