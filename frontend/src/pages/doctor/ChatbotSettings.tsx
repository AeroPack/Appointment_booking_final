import { useState, useEffect } from "react";
import { Loader2, CheckCircle2, AlertCircle, Copy, Bot } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { Switch } from "@/core/components/ui/switch";
import { Card, CardContent } from "@/core/components/ui/card";
import { useGetChatbotConfigQuery, useUpdateChatbotConfigMutation } from "@/features/doctors/chatbotApi";

export default function ChatbotSettings() {
  const { data: config, isLoading: configLoading } = useGetChatbotConfigQuery();
  const [updateConfig, { isLoading: saving }] = useUpdateChatbotConfigMutation();

  const [isEnabled, setIsEnabled] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [copied, setCopied] = useState(false);

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
    if (!config?.typebot_embed_snippet) return;
    navigator.clipboard.writeText(config.typebot_embed_snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
          {config?.typebot_embed_snippet ? (
            <>
              <p className="text-sm text-muted-foreground">
                Copy this code and paste it into your website's HTML, just before the closing{" "}
                <code>&lt;/body&gt;</code> tag.
              </p>
              <div className="relative">
                <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-xs overflow-x-auto font-mono whitespace-pre-wrap">
                  {config.typebot_embed_snippet}
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
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Your chatbot is being set up by our team. Once it's ready, your embed code will appear
              here.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
