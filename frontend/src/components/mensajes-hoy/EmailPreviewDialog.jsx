/**
 * Email Preview Dialog
 * Modal for previewing and sending generated emails
 */
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Mail, RefreshCw } from "lucide-react";
import { EMAIL_RULE_COLORS } from "./constants";

export function EmailPreviewDialog({ 
  open, 
  onOpenChange, 
  contact,
  email,
  onEmailChange,
  onSend,
  onRegenerate,
  isGenerating = false,
  isSending = false,
}) {
  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111] border-[#222] max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-purple-400" />
            Preview Email
            {contact && (
              <Badge variant="outline" className={EMAIL_RULE_COLORS[contact.rule_type]}>
                {contact.rule_type}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {contact && (
              <>To: <span className="text-blue-400">{contact.email}</span></>
            )}
          </DialogDescription>
        </DialogHeader>
        
        {isGenerating ? (
          <div className="py-12 text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-purple-400 mx-auto mb-3" />
            <p className="text-slate-400">Generating email with AI...</p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Subject */}
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Subject</label>
              <Input
                value={email.subject}
                onChange={(e) => onEmailChange({ ...email, subject: e.target.value })}
                className="bg-[#0a0a0a] border-[#333] text-white"
                placeholder="Email subject..."
              />
            </div>
            
            {/* Body */}
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Body</label>
              <textarea
                value={email.body}
                onChange={(e) => onEmailChange({ ...email, body: e.target.value })}
                className="w-full h-48 bg-[#0a0a0a] border border-[#333] rounded-md p-3 text-white resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Email body..."
              />
            </div>
            
            {/* Regenerate button */}
            <Button
              variant="outline"
              size="sm"
              onClick={onRegenerate}
              className="border-[#333] text-slate-400"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Regenerate
            </Button>
          </div>
        )}
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            className="border-[#333]"
          >
            Cancel
          </Button>
          <Button
            onClick={onSend}
            disabled={isSending || isGenerating || !email.subject || !email.body}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isSending ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EmailPreviewDialog;
