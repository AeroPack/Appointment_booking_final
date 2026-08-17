import { useState, useEffect } from "react";
import { Loader2, CheckCircle2, AlertCircle, Copy, Bot, RefreshCw, MessageSquare, HelpCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { Switch } from "@/core/components/ui/switch";
import { Card, CardContent } from "@/core/components/ui/card";
import { Input } from "@/core/components/ui/input";
import { useGetChatbotConfigQuery, useUpdateChatbotConfigMutation, useRegenerateWidgetKeyMutation } from "@/features/doctors/chatbotApi";
import { WhatsAppIntegrationPage } from "@/features/doctors/components/WhatsAppIntegrationPage";
import {
  useGetFaqsQuery,
  useCreateFaqMutation,
  useUpdateFaqMutation,
  useDeleteFaqMutation,
  type FaqEntry
} from "@/features/doctors/faqApi";
import { env } from "@/core/config/env";
import { toast } from "sonner";

const PUBLIC_API_HOST = env.VITE_PUBLIC_API_URL || window.location.origin;

type TabId = "widget" | "whatsapp" | "faq";

const TABS: { id: TabId; label: string; icon: typeof Bot }[] = [
  { id: "widget", label: "Web Widget", icon: Bot },
  { id: "whatsapp", label: "WhatsApp Chatbot", icon: MessageSquare },
  { id: "faq", label: "FAQ", icon: HelpCircle },
];

export default function ChatbotSettings() {
  const [activeTab, setActiveTab] = useState<TabId>("widget");

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Bot className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Chatbot</h1>
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      {activeTab === "whatsapp" && <WhatsAppIntegrationPage />}
      {activeTab === "widget" && <WidgetTabContent />}
      {activeTab === "faq" && <FaqTabContent />}
    </div>
  );
}

/* ────────────── Widget Tab ────────────── */

function WidgetTabContent() {
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
    <>
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
    </>
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

/* ────────────── FAQ Tab ────────────── */

function FaqTabContent() {
  const { data: faqItems, isLoading } = useGetFaqsQuery();
  const [createFaq, { isLoading: isCreating }] = useCreateFaqMutation();
  const [updateFaq] = useUpdateFaqMutation();
  const [deleteFaq] = useDeleteFaqMutation();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [editQuestion, setEditQuestion] = useState("");
  const [editAnswer, setEditAnswer] = useState("");

  const handleCreate = async () => {
    if (!newQuestion.trim() || !newAnswer.trim()) {
      toast.error("Both question and answer are required");
      return;
    }
    try {
      await createFaq({ question: newQuestion.trim(), answer: newAnswer.trim() }).unwrap();
      setNewQuestion("");
      setNewAnswer("");
      toast.success("FAQ item created");
    } catch {
      toast.error("Failed to create FAQ item");
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editQuestion.trim() || !editAnswer.trim()) {
      toast.error("Both question and answer are required");
      return;
    }
    try {
      await updateFaq({ id, question: editQuestion.trim(), answer: editAnswer.trim() }).unwrap();
      setEditingId(null);
      toast.success("FAQ item updated");
    } catch {
      toast.error("Failed to update FAQ item");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this FAQ item?")) return;
    try {
      await deleteFaq(id).unwrap();
      toast.success("FAQ item deleted");
    } catch {
      toast.error("Failed to delete FAQ item");
    }
  };

  const startEdit = (item: FaqEntry) => {
    setEditingId(item.id);
    setEditQuestion(item.question);
    setEditAnswer(item.answer);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add FAQ Item
          </h2>
          <Input
            placeholder="Question"
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
          />
          <textarea
            className="w-full p-3 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Answer"
            rows={3}
            value={newAnswer}
            onChange={(e) => setNewAnswer(e.target.value)}
          />
          <Button onClick={handleCreate} disabled={isCreating || !newQuestion.trim() || !newAnswer.trim()}>
            {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            Add FAQ
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          {faqItems?.length ?? 0} FAQ item{(faqItems?.length ?? 0) !== 1 ? "s" : ""}
        </h3>
        {(faqItems ?? []).map((item) => (
          <Card key={item.id}>
            <CardContent className="p-4">
              {editingId === item.id ? (
                <div className="space-y-3">
                  <Input
                    value={editQuestion}
                    onChange={(e) => setEditQuestion(e.target.value)}
                    placeholder="Question"
                  />
                  <textarea
                    className="w-full p-3 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                    rows={3}
                    value={editAnswer}
                    onChange={(e) => setEditAnswer(e.target.value)}
                    placeholder="Answer"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleUpdate(item.id)}>Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{item.question}</p>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{item.answer}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(item)}>Edit</Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {faqItems?.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No FAQ items yet. Add your first one above.</p>
        )}
      </div>
    </div>
  );
}
