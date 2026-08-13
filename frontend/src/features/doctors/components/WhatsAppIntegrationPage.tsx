import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/core/components/ui/card'
import { Button } from '@/core/components/ui/button'
import { Input } from '@/core/components/ui/input'
import { Badge } from '@/core/components/ui/badge'
import { Loader2, Wifi, WifiOff, Phone, RefreshCw } from 'lucide-react'
import {
  useGetWhatsAppStatusQuery,
  useConnectWhatsAppMutation,
  useGetQrCodeQuery,
  useDisconnectWhatsAppMutation,
} from '../evolutionApi'

function normalizeQrDataUrl(qrcode?: string): string | undefined {
  if (!qrcode) return undefined
  if (qrcode.startsWith('data:')) return qrcode
  return `data:image/png;base64,${qrcode}`
}

export function WhatsAppIntegrationPage() {
  const [phoneNumber, setPhoneNumber] = useState('')
  const { data: status, isLoading: statusLoading } = useGetWhatsAppStatusQuery(undefined, {
    pollingInterval: 5000,
  })
  const [connect, { isLoading: connectLoading }] = useConnectWhatsAppMutation()
  const [disconnect, { isLoading: disconnectLoading }] = useDisconnectWhatsAppMutation()
  const { data: qrData, refetch: refetchQr } = useGetQrCodeQuery(undefined, {
    skip: status?.status !== 'connecting',
    pollingInterval: 5000,
  })

  const isConnected = status?.status === 'connected'
  const isConnecting = status?.status === 'connecting'

  const handleConnect = async () => {
    if (!phoneNumber) return
    await connect({ phoneNumber })
  }

  const handleDisconnect = async () => {
    await disconnect()
    setPhoneNumber('')
  }

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  const qrSrc = normalizeQrDataUrl(qrData?.qrcode)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Phone className="h-5 w-5" />
            WhatsApp Chatbot Integration
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Status:</span>
            {isConnected ? (
              <Badge variant="default" className="bg-green-500">
                <Wifi className="mr-1 h-3 w-3" />
                Connected
              </Badge>
            ) : isConnecting ? (
              <Badge variant="secondary">
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Connecting...
              </Badge>
            ) : (
              <Badge variant="destructive">
                <WifiOff className="mr-1 h-3 w-3" />
                Disconnected
              </Badge>
            )}
          </div>

          {!isConnected && !isConnecting && (
            <div className="flex gap-3">
              <Input
                placeholder="Phone number with country code (e.g., 919876543210)"
                value={phoneNumber}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhoneNumber(e.target.value)}
                className="max-w-sm"
              />
              <Button onClick={handleConnect} disabled={!phoneNumber || connectLoading}>
                {connectLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Connect WhatsApp
              </Button>
            </div>
          )}

          {isConnecting && (
            <div className="flex flex-col items-center gap-4 p-6 border rounded-lg">
              <p className="text-sm text-muted-foreground">
                Scan this QR code with WhatsApp (Linked Devices)
              </p>
              {qrSrc ? (
                <img
                  src={qrSrc}
                  alt="WhatsApp QR Code"
                  className="w-64 h-64 border rounded"
                />
              ) : (
                <div className="w-64 h-64 border rounded flex items-center justify-center bg-muted/20">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Open WhatsApp {'>'} Settings {'>'} Linked Devices {'>'} Link a Device
              </p>
              <Button variant="outline" size="sm" onClick={() => refetchQr()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh QR Code
              </Button>
            </div>
          )}

          {isConnected && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Your WhatsApp chatbot is active. Patients can now message your WhatsApp number to book appointments.
              </p>
              <Button
                variant="destructive"
                onClick={handleDisconnect}
                disabled={disconnectLoading}
              >
                {disconnectLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Disconnect
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
