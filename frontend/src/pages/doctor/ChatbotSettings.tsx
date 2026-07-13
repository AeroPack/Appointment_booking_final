import { useState } from "react";
import {
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Copy,
  Bot,
  MessageCircle,
  Pencil,
  Check,
} from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { Switch } from "@/core/components/ui/switch";
import { Card, CardContent } from "@/core/components/ui/card";
import { Input } from "@/core/components/ui/input";
import {
  useGetChatbotConfigQuery,
  useUpdateChatbotConfigMutation,
  useListFaqQuery,
  useCreateFaqMutation,
  useUpdateFaqMutation,
  useDeleteFaqMutation,
} from "@/features/doctors/chatbotApi";
import { useAppSelector } from "@/core/store/hooks";

export default function ChatbotSettings() {
  const user = useAppSelector((s) => s.auth.user);
  const doctorId = user?.id || "";

  const { data: config, isLoading: configLoading } = useGetChatbotConfigQuery();
  const [updateConfig, { isLoading: saving }] = useUpdateChatbotConfigMutation();

  const { data: faqList = [], isLoading: faqLoading } = useListFaqQuery();
  const [createFaq, { isLoading: creatingFaq }] = useCreateFaqMutation();
  const [updateFaq, { isLoading: updatingFaq }] = useUpdateFaqMutation();
  const [deleteFaq] = useDeleteFaqMutation();

  const [isEnabled, setIsEnabled] = useState(false);
  const [primaryColor, setPrimaryColor] = useState("#3b82f6");
  const [greetingMsg, setGreetingMsg] = useState("Hi! How can I help you today?");
  const [position, setPosition] = useState<"bottom-right" | "bottom-left">("bottom-right");

  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [showFaqForm, setShowFaqForm] = useState(false);

  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState("");
  const [editAnswer, setEditAnswer] = useState("");

  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [copied, setCopied] = useState(false);

  // Sync config to local state
  useState(() => {
    if (config) {
      setIsEnabled(config.is_enabled);
      setPrimaryColor(config.primary_color);
      setGreetingMsg(config.greeting_msg);
      setPosition(config.position as "bottom-right" | "bottom-left");
    }
  });

  const handleSave = async () => {
    try {
      await updateConfig({
        is_enabled: isEnabled,
        primary_color: primaryColor,
        greeting_msg: greetingMsg,
        position,
      }).unwrap();
      setStatus("success");
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  const handleAddFaq = async () => {
    if (!newQuestion.trim() || !newAnswer.trim()) return;
    try {
      await createFaq({ question: newQuestion.trim(), answer: newAnswer.trim() }).unwrap();
      setNewQuestion("");
      setNewAnswer("");
      setShowFaqForm(false);
    } catch {
      // error handled by RTK Query
    }
  };

  const handleDeleteFaq = async (id: string) => {
    try {
      await deleteFaq(id).unwrap();
    } catch {
      // error handled by RTK Query
    }
  };

  const handleStartEdit = (faq: { id: string; question: string; answer: string }) => {
    setEditingFaqId(faq.id);
    setEditQuestion(faq.question);
    setEditAnswer(faq.answer);
  };

  const handleCancelEdit = () => {
    setEditingFaqId(null);
    setEditQuestion("");
    setEditAnswer("");
  };

  const handleSaveEdit = async () => {
    if (!editingFaqId || !editQuestion.trim() || !editAnswer.trim()) return;
    try {
      await updateFaq({
        id: editingFaqId,
        question: editQuestion.trim(),
        answer: editAnswer.trim(),
      }).unwrap();
      setEditingFaqId(null);
      setEditQuestion("");
      setEditAnswer("");
    } catch {
      // error handled by RTK Query
    }
  };

  const embedSnippet = `<script
  src="${window.location.origin}/chatbot.js"
  data-doctor-id="${doctorId}"
  data-api-host="${window.location.origin}"
  data-bot-api-key="YOUR_BOT_API_KEY"
  data-primary-color="${primaryColor}"
  data-greeting="${greetingMsg}"
  data-position="${position}"
></script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(embedSnippet);
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

      {/* Status Messages */}
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

      {/* Widget Configuration */}
      <Card>
        <CardContent className="p-6 space-y-5">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuration
          </h2>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Enable Chatbot Widget</p>
              <p className="text-sm text-muted-foreground">
                Show a chat bubble on your website for patients to book appointments
              </p>
            </div>
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Widget Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-10 rounded border cursor-pointer"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  placeholder="#3b82f6"
                  className="flex-1"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Position</label>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value as "bottom-right" | "bottom-left")}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="bottom-right">Bottom Right</option>
                <option value="bottom-left">Bottom Left</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Greeting Message</label>
            <Input
              value={greetingMsg}
              onChange={(e) => setGreetingMsg(e.target.value)}
              placeholder="Hi! How can I help you today?"
            />
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Settings
          </Button>
        </CardContent>
      </Card>

      {/* Embed Snippet */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Embed Snippet
          </h2>
          <p className="text-sm text-muted-foreground">
            Copy this code and paste it into your website's HTML, just before the closing <code>&lt;/body&gt;</code> tag.
          </p>
          <div className="relative">
            <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-xs overflow-x-auto font-mono">
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

      {/* FAQ Management */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              FAQ Questions
            </h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowFaqForm(!showFaqForm)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add FAQ
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Patients can ask questions during the chat. Add common Q&A pairs here.
          </p>

          {showFaqForm && (
            <div className="border rounded-lg p-4 space-y-3 bg-slate-50">
              <Input
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="Question (e.g., What are your fees?)"
              />
              <Input
                value={newAnswer}
                onChange={(e) => setNewAnswer(e.target.value)}
                placeholder="Answer (e.g., Consultation fee is Rs. 500)"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddFaq} disabled={creatingFaq || !newQuestion.trim() || !newAnswer.trim()}>
                  {creatingFaq ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                  Add
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowFaqForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {faqLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : faqList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No FAQ entries yet. Add some common questions patients ask.
            </p>
          ) : (
            <div className="space-y-2">
              {faqList.map((faq) => (
                <div key={faq.id} className="p-3 border rounded-lg bg-white">
                  {editingFaqId === faq.id ? (
                    <div className="space-y-3">
                      <Input
                        value={editQuestion}
                        onChange={(e) => setEditQuestion(e.target.value)}
                        placeholder="Question"
                      />
                      <Input
                        value={editAnswer}
                        onChange={(e) => setEditAnswer(e.target.value)}
                        placeholder="Answer"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleSaveEdit}
                          disabled={updatingFaq || !editQuestion.trim() || !editAnswer.trim()}
                        >
                          {updatingFaq ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{faq.question}</p>
                        <p className="text-sm text-muted-foreground mt-1">{faq.answer}</p>
                      </div>
                      <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-[#64748B] hover:text-[#191c1e]"
                          onClick={() => handleStartEdit(faq)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => handleDeleteFaq(faq.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Settings(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
