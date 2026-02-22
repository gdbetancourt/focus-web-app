/**
 * ContactInputs - Reusable input components for contact management
 */
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Phone, Star, Trash2, AlertTriangle, Mail } from "lucide-react";
import { COUNTRY_CODES } from "./constants";

/**
 * PhoneInput - Reusable phone input with country code selector
 */
export function PhoneInput({
  phone,
  index,
  isPrimary,
  countryCode,
  onPhoneChange,
  onCountryChange,
  onSetPrimary,
  onRemove,
  canRemove = true,
  duplicate = null,
  isValid = true,
}) {
  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        {/* Country code selector */}
        <Select value={countryCode || "+52"} onValueChange={(val) => onCountryChange(index, val)}>
          <SelectTrigger className="w-[100px] bg-[#0a0a0a] border-[#333]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#111] border-[#333] max-h-[300px]">
            {COUNTRY_CODES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                <span className="flex items-center gap-1">
                  <span>{c.flag}</span>
                  <span className="text-xs">{c.code === "none" ? "—" : c.code}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {/* Phone input */}
        <div className="flex-1 relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            value={phone}
            onChange={(e) => onPhoneChange(index, e.target.value)}
            placeholder="Número de teléfono"
            className={`pl-9 bg-[#0a0a0a] border-[#333] ${!isValid ? 'border-red-500/50' : ''}`}
          />
        </div>
        
        {/* Primary star */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onSetPrimary(index)}
          className={isPrimary ? "text-yellow-400" : "text-slate-600"}
          title={isPrimary ? "Teléfono principal" : "Marcar como principal"}
        >
          <Star className="w-4 h-4" fill={isPrimary ? "currentColor" : "none"} />
        </Button>
        
        {/* Remove button */}
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRemove(index)}
            className="text-slate-600 hover:text-red-400"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
      
      {/* Duplicate warning */}
      {duplicate && duplicate.length > 0 && (
        <div className="flex items-center gap-2 text-yellow-500 text-xs ml-[108px]">
          <AlertTriangle className="w-3 h-3" />
          <span>
            Teléfono ya existe en: {duplicate.map(d => d.name || d.email).join(", ")}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * EmailInput - Reusable email input with primary selector
 */
export function EmailInput({
  email,
  index,
  isPrimary,
  onEmailChange,
  onSetPrimary,
  onRemove,
  canRemove = true,
  duplicate = null,
  isValid = true,
}) {
  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        {/* Email input */}
        <div className="flex-1 relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            type="email"
            value={email}
            onChange={(e) => onEmailChange(index, e.target.value)}
            placeholder="correo@ejemplo.com"
            className={`pl-9 bg-[#0a0a0a] border-[#333] ${!isValid ? 'border-red-500/50' : ''}`}
          />
        </div>
        
        {/* Primary star */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onSetPrimary(index)}
          className={isPrimary ? "text-yellow-400" : "text-slate-600"}
          title={isPrimary ? "Email principal" : "Marcar como principal"}
        >
          <Star className="w-4 h-4" fill={isPrimary ? "currentColor" : "none"} />
        </Button>
        
        {/* Remove button */}
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRemove(index)}
            className="text-slate-600 hover:text-red-400"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
      
      {/* Duplicate warning */}
      {duplicate && duplicate.length > 0 && (
        <div className="flex items-center gap-2 text-yellow-500 text-xs">
          <AlertTriangle className="w-3 h-3" />
          <span>
            Email ya existe en: {duplicate.map(d => d.name || d.email).join(", ")}
          </span>
        </div>
      )}
    </div>
  );
}
