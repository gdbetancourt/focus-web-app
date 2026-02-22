/**
 * Add LinkedIn URL Dialog
 * Modal for adding LinkedIn URL to a contact
 */
import { useState, useRef, useEffect } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Linkedin } from "lucide-react";

export function AddLinkedinDialog({ 
  open, 
  onOpenChange, 
  contact, 
  onSave 
}) {
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const prevContactRef = useRef(contact);

  // Track contact changes
  useEffect(() => {
    if (contact && prevContactRef.current !== contact) {
      prevContactRef.current = contact;
    }
  }, [contact]);
  
  // Reset URL when dialog opens with a new contact  
  const currentUrl = open ? linkedinUrl : "";

  const handleSave = () => {
    if (currentUrl.trim()) {
      onSave(currentUrl.trim());
      setLinkedinUrl("");
    }
  };

  const handleClose = () => {
    setLinkedinUrl("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111] border-[#222]">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Linkedin className="w-5 h-5 text-blue-400" />
            Add LinkedIn URL
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Add LinkedIn profile URL for {contact?.name}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Input
            placeholder="https://linkedin.com/in/username"
            value={currentUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            className="bg-[#0a0a0a] border-[#333]"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            className="border-[#333]"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            className="bg-blue-600 hover:bg-blue-700"
            disabled={!currentUrl.trim()}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AddLinkedinDialog;
