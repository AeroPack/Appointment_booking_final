import { useState, useEffect } from "react";
import { Loader2, CheckCircle2, AlertCircle, Copy, Bot, RefreshCw } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { Switch } from "@/core/components/ui/switch";
import { Card, CardContent } from "@/core/components/ui/card";
import { useGetChatbotConfigQuery, useUpdateChatbotConfigMutation, useRegenerateWidgetKeyMutation } from "@/features/doctors/chatbotApi";
import { env } from "@/core/config/env";

const PUBLIC_API_HOST = env.VITE_PUBLIC_API_URL || window.location.origin;

export default function ChatbotSettings() {
  const { data: config, isLoading: configLoading } = useGetChatbotConfigQuery();
  const [updateConfig, { isLoading: saving }] = useUpdateChatbotConfigMutation();
  const [regenerateKey, { isLoading: regenerating }] = useRegenerateWidgetKeyMutation();

  const [isEnabled, setIsEnabled] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [copied, setCopied] = useState(false);
  const [regenerateStatus, setRegenerateStatus] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    if (config) setIsEnabled(config.is_enabled);
  }, [config]);

  const handleToggle = async (checked: boolean) => {
    setIsEnabled(checked);
    try {
      await updateConfig({ is_enabled: checked }).unwrap();
      setStatus("success");
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setIsEnabled(!checked);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  const handleCopy = () => {
    const snippet = buildEmbedSnippet(config);
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    try {
      await regenerateKey().unwrap();
      setRegenerateStatus("success");
      setTimeout(() => setRegenerateStatus("idle"), 3000);
    } catch {
      setRegenerateStatus("error");
      setTimeout(() => setRegenerateStatus("idle"), 3000);
    }
  };

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const embedSnippet = buildEmbedSnippet(config);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Bot className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Chatbot Widget</h1>
      </div>

      {status === "success" && (
        <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
          <CheckCircle2 className="h-4 w-4" />
          Settings saved successfully
        </div>
      )}
      {status === "error" && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          <AlertCircle className="h-4 w-4" />
          Failed to save settings. Please try again.
        </div>
      )}
      {regenerateStatus === "success" && (
        <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
          <CheckCircle2 className="h-4 w-4" />
          Widget key regenerated. Update your embed snippet with the new key.
        </div>
      )}
      {regenerateStatus === "error" && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          <AlertCircle className="h-4 w-4" />
          Failed to regenerate key. Please try again.
        </div>
      )}

      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Enable Chatbot Widget</p>
              <p className="text-sm text-muted-foreground">
                Show the chat widget on your website for patients to book appointments
              </p>
            </div>
            <Switch checked={isEnabled} onCheckedChange={handleToggle} disabled={saving} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Embed Snippet
          </h2>
          <p className="text-sm text-muted-foreground">
            Copy this code and paste it into your website's{" "}
            <code>&lt;head&gt;</code> section.
          </p>
          <div className="relative">
            <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-xs overflow-x-auto font-mono whitespace-pre-wrap">
              {embedSnippet}
            </pre>
            <Button
              size="sm"
              variant="secondary"
              className="absolute top-2 right-2"
              onClick={handleCopy}
            >
              {copied ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Widget Key</h2>
          <div className="flex items-center gap-3">
            <code className="flex-1 bg-slate-100 px-3 py-2 rounded text-sm font-mono break-all">
              {config?.widget_key || "No key generated"}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={regenerating}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${regenerating ? 'animate-spin' : ''}`} />
              Regenerate
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            This key is embedded in the snippet above. Regenerate it if you suspect it has been
            compromised. The old key will stop working immediately.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

interface ChatbotConfig {
  widget_key?: string;
  primary_color?: string;
  greeting_msg?: string;
  position?: string;
}

function buildEmbedSnippet(config?: ChatbotConfig): string {
  if (!config?.widget_key) return "<!-- Widget key not yet generated. Enable the chatbot first. -->";
  const color = config.primary_color || "#3b82f6";
  const greeting = config.greeting_msg || "Hi! How can I help you today?";
  const position = config.position || "bottom-right";
  return `<script src="${PUBLIC_API_HOST}/chatbot.js" data-widget-key="${config.widget_key}" data-api-host="${PUBLIC_API_HOST}" data-primary-color="${color}" data-greeting="${greeting}" data-position="${position}" async></script>`;
}
