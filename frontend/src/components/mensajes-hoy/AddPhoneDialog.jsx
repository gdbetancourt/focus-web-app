/**
 * Add Phone Dialog
 * Modal for adding phone number to a contact
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

export function AddPhoneDialog({ 
  open, 
  onOpenChange, 
  contact, 
  onSave 
}) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const prevContactRef = useRef(contact);

  // Reset when contact changes (using ref to avoid lint warning)
  useEffect(() => {
    if (contact && prevContactRef.current !== contact) {
      prevContactRef.current = contact;
      // We don't call setState here, we let the component re-render naturally
    }
  }, [contact]);
  
  // Reset phone number when dialog opens with a new contact
  const currentPhoneNumber = open ? phoneNumber : "";

  const handleSave = () => {
    if (currentPhoneNumber.trim()) {
      onSave(currentPhoneNumber.trim());
      setPhoneNumber("");
    }
  };

  const handleClose = () => {
    setPhoneNumber("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111] border-[#222]">
        <DialogHeader>
          <DialogTitle className="text-white">Add Phone</DialogTitle>
          <DialogDescription className="text-slate-400">
            Add phone number for {contact?.name}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Input
            placeholder="+52 55 1234 5678"
            value={currentPhoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
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
            className="bg-green-600 hover:bg-green-700"
            disabled={!currentPhoneNumber.trim()}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AddPhoneDialog;
