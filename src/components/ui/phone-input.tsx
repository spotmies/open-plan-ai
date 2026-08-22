import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Country {
  name: string;
  code: string;
  dialCode: string;
  flag: string;
  minLen: number; // min local digits
  maxLen: number; // max local digits
}

const COUNTRIES: Country[] = [
  { name: "Afghanistan", code: "AF", dialCode: "93", flag: "🇦🇫", minLen: 9, maxLen: 9 },
  { name: "Albania", code: "AL", dialCode: "355", flag: "🇦🇱", minLen: 9, maxLen: 9 },
  { name: "Algeria", code: "DZ", dialCode: "213", flag: "🇩🇿", minLen: 9, maxLen: 9 },
  { name: "Argentina", code: "AR", dialCode: "54", flag: "🇦🇷", minLen: 10, maxLen: 10 },
  { name: "Australia", code: "AU", dialCode: "61", flag: "🇦🇺", minLen: 9, maxLen: 9 },
  { name: "Austria", code: "AT", dialCode: "43", flag: "🇦🇹", minLen: 10, maxLen: 11 },
  { name: "Bangladesh", code: "BD", dialCode: "880", flag: "🇧🇩", minLen: 10, maxLen: 10 },
  { name: "Belgium", code: "BE", dialCode: "32", flag: "🇧🇪", minLen: 9, maxLen: 9 },
  { name: "Brazil", code: "BR", dialCode: "55", flag: "🇧🇷", minLen: 10, maxLen: 11 },
  { name: "Canada", code: "CA", dialCode: "1", flag: "🇨🇦", minLen: 10, maxLen: 10 },
  { name: "Chile", code: "CL", dialCode: "56", flag: "🇨🇱", minLen: 9, maxLen: 9 },
  { name: "China", code: "CN", dialCode: "86", flag: "🇨🇳", minLen: 11, maxLen: 11 },
  { name: "Colombia", code: "CO", dialCode: "57", flag: "🇨🇴", minLen: 10, maxLen: 10 },
  { name: "Croatia", code: "HR", dialCode: "385", flag: "🇭🇷", minLen: 8, maxLen: 9 },
  { name: "Czech Republic", code: "CZ", dialCode: "420", flag: "🇨🇿", minLen: 9, maxLen: 9 },
  { name: "Denmark", code: "DK", dialCode: "45", flag: "🇩🇰", minLen: 8, maxLen: 8 },
  { name: "Egypt", code: "EG", dialCode: "20", flag: "🇪🇬", minLen: 10, maxLen: 10 },
  { name: "Ethiopia", code: "ET", dialCode: "251", flag: "🇪🇹", minLen: 9, maxLen: 9 },
  { name: "Finland", code: "FI", dialCode: "358", flag: "🇫🇮", minLen: 9, maxLen: 10 },
  { name: "France", code: "FR", dialCode: "33", flag: "🇫🇷", minLen: 9, maxLen: 9 },
  { name: "Germany", code: "DE", dialCode: "49", flag: "🇩🇪", minLen: 10, maxLen: 11 },
  { name: "Ghana", code: "GH", dialCode: "233", flag: "🇬🇭", minLen: 9, maxLen: 9 },
  { name: "Greece", code: "GR", dialCode: "30", flag: "🇬🇷", minLen: 10, maxLen: 10 },
  { name: "Hong Kong", code: "HK", dialCode: "852", flag: "🇭🇰", minLen: 8, maxLen: 8 },
  { name: "Hungary", code: "HU", dialCode: "36", flag: "🇭🇺", minLen: 9, maxLen: 9 },
  { name: "India", code: "IN", dialCode: "91", flag: "🇮🇳", minLen: 10, maxLen: 10 },
  { name: "Indonesia", code: "ID", dialCode: "62", flag: "🇮🇩", minLen: 9, maxLen: 12 },
  { name: "Iran", code: "IR", dialCode: "98", flag: "🇮🇷", minLen: 10, maxLen: 10 },
  { name: "Iraq", code: "IQ", dialCode: "964", flag: "🇮🇶", minLen: 10, maxLen: 10 },
  { name: "Ireland", code: "IE", dialCode: "353", flag: "🇮🇪", minLen: 9, maxLen: 9 },
  { name: "Israel", code: "IL", dialCode: "972", flag: "🇮🇱", minLen: 9, maxLen: 9 },
  { name: "Italy", code: "IT", dialCode: "39", flag: "🇮🇹", minLen: 9, maxLen: 10 },
  { name: "Japan", code: "JP", dialCode: "81", flag: "🇯🇵", minLen: 10, maxLen: 11 },
  { name: "Jordan", code: "JO", dialCode: "962", flag: "🇯🇴", minLen: 9, maxLen: 9 },
  { name: "Kenya", code: "KE", dialCode: "254", flag: "🇰🇪", minLen: 9, maxLen: 9 },
  { name: "Kuwait", code: "KW", dialCode: "965", flag: "🇰🇼", minLen: 8, maxLen: 8 },
  { name: "Malaysia", code: "MY", dialCode: "60", flag: "🇲🇾", minLen: 9, maxLen: 10 },
  { name: "Mexico", code: "MX", dialCode: "52", flag: "🇲🇽", minLen: 10, maxLen: 10 },
  { name: "Morocco", code: "MA", dialCode: "212", flag: "🇲🇦", minLen: 9, maxLen: 9 },
  { name: "Myanmar", code: "MM", dialCode: "95", flag: "🇲🇲", minLen: 8, maxLen: 10 },
  { name: "Netherlands", code: "NL", dialCode: "31", flag: "🇳🇱", minLen: 9, maxLen: 9 },
  { name: "New Zealand", code: "NZ", dialCode: "64", flag: "🇳🇿", minLen: 8, maxLen: 10 },
  { name: "Nigeria", code: "NG", dialCode: "234", flag: "🇳🇬", minLen: 10, maxLen: 10 },
  { name: "Norway", code: "NO", dialCode: "47", flag: "🇳🇴", minLen: 8, maxLen: 8 },
  { name: "Pakistan", code: "PK", dialCode: "92", flag: "🇵🇰", minLen: 10, maxLen: 10 },
  { name: "Peru", code: "PE", dialCode: "51", flag: "🇵🇪", minLen: 9, maxLen: 9 },
  { name: "Philippines", code: "PH", dialCode: "63", flag: "🇵🇭", minLen: 10, maxLen: 10 },
  { name: "Poland", code: "PL", dialCode: "48", flag: "🇵🇱", minLen: 9, maxLen: 9 },
  { name: "Portugal", code: "PT", dialCode: "351", flag: "🇵🇹", minLen: 9, maxLen: 9 },
  { name: "Qatar", code: "QA", dialCode: "974", flag: "🇶🇦", minLen: 8, maxLen: 8 },
  { name: "Romania", code: "RO", dialCode: "40", flag: "🇷🇴", minLen: 9, maxLen: 9 },
  { name: "Russia", code: "RU", dialCode: "7", flag: "🇷🇺", minLen: 10, maxLen: 10 },
  { name: "Saudi Arabia", code: "SA", dialCode: "966", flag: "🇸🇦", minLen: 9, maxLen: 9 },
  { name: "Singapore", code: "SG", dialCode: "65", flag: "🇸🇬", minLen: 8, maxLen: 8 },
  { name: "South Africa", code: "ZA", dialCode: "27", flag: "🇿🇦", minLen: 9, maxLen: 9 },
  { name: "South Korea", code: "KR", dialCode: "82", flag: "🇰🇷", minLen: 9, maxLen: 10 },
  { name: "Spain", code: "ES", dialCode: "34", flag: "🇪🇸", minLen: 9, maxLen: 9 },
  { name: "Sri Lanka", code: "LK", dialCode: "94", flag: "🇱🇰", minLen: 9, maxLen: 9 },
  { name: "Sweden", code: "SE", dialCode: "46", flag: "🇸🇪", minLen: 9, maxLen: 9 },
  { name: "Switzerland", code: "CH", dialCode: "41", flag: "🇨🇭", minLen: 9, maxLen: 9 },
  { name: "Taiwan", code: "TW", dialCode: "886", flag: "🇹🇼", minLen: 9, maxLen: 9 },
  { name: "Tanzania", code: "TZ", dialCode: "255", flag: "🇹🇿", minLen: 9, maxLen: 9 },
  { name: "Thailand", code: "TH", dialCode: "66", flag: "🇹🇭", minLen: 9, maxLen: 9 },
  { name: "Turkey", code: "TR", dialCode: "90", flag: "🇹🇷", minLen: 10, maxLen: 10 },
  { name: "Ukraine", code: "UA", dialCode: "380", flag: "🇺🇦", minLen: 9, maxLen: 9 },
  { name: "United Arab Emirates", code: "AE", dialCode: "971", flag: "🇦🇪", minLen: 9, maxLen: 9 },
  { name: "United Kingdom", code: "GB", dialCode: "44", flag: "🇬🇧", minLen: 10, maxLen: 10 },
  { name: "United States", code: "US", dialCode: "1", flag: "🇺🇸", minLen: 10, maxLen: 10 },
  { name: "Venezuela", code: "VE", dialCode: "58", flag: "🇻🇪", minLen: 10, maxLen: 10 },
  { name: "Vietnam", code: "VN", dialCode: "84", flag: "🇻🇳", minLen: 9, maxLen: 10 },
];

function parseExistingValue(value: string): { country: Country; local: string } {
  const defaultCountry = COUNTRIES.find((c) => c.code === "US")!;
  if (!value) return { country: defaultCountry, local: "" };

  const digits = value.startsWith("+") ? value.slice(1) : value;

  // Try longest dial codes first to avoid false matches (e.g. "1" vs "971")
  const sorted = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
  for (const country of sorted) {
    if (digits.startsWith(country.dialCode)) {
      return { country, local: digits.slice(country.dialCode.length) };
    }
  }
  return { country: defaultCountry, local: digits };
}

function validateLocal(local: string, country: Country): string {
  if (local.length === 0) return "";
  if (local.length < country.minLen) {
    return `Enter ${country.minLen}${country.minLen !== country.maxLen ? `–${country.maxLen}` : ""} digits for ${country.name}`;
  }
  if (local.length > country.maxLen) {
    return `Too many digits for ${country.name} (max ${country.maxLen})`;
  }
  return "";
}

interface PhoneInputProps {
  value: string;
  onChange: (fullValue: string, error: string) => void;
  className?: string;
  disabled?: boolean;
}

export function PhoneInput({ value, onChange, className, disabled }: PhoneInputProps) {
  const parsed = parseExistingValue(value);
  const [selectedCountry, setSelectedCountry] = useState<Country>(parsed.country);
  const [localNumber, setLocalNumber] = useState(parsed.local);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Sync external value changes (e.g. form reset)
  useEffect(() => {
    const p = parseExistingValue(value);
    setSelectedCountry(p.country);
    setLocalNumber(p.local);
  }, [value]);

  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    } else {
      setSearch("");
    }
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const filtered = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.dialCode.includes(search.replace(/^\+/, ""))
  );

  function handleCountrySelect(country: Country) {
    setSelectedCountry(country);
    setOpen(false);
    const error = validateLocal(localNumber, country);
    const full = localNumber ? `+${country.dialCode}${localNumber}` : "";
    onChange(full, error);
  }

  function handleLocalChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, "");
    const clamped = raw.slice(0, selectedCountry.maxLen);
    setLocalNumber(clamped);
    const error = validateLocal(clamped, selectedCountry);
    const full = clamped ? `+${selectedCountry.dialCode}${clamped}` : "";
    onChange(full, error);
  }

  return (
    <div className={cn("relative flex gap-0", className)} ref={dropdownRef}>
      {/* Country picker */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1.5 px-3 h-9 rounded-l-md border border-r-0 border-input bg-background",
          "text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0",
          "disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        )}
      >
        <span className="text-base leading-none">{selectedCountry.flag}</span>
        <span className="text-muted-foreground">+{selectedCountry.dialCode}</span>
        <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {/* Local number input */}
      <input
        type="tel"
        inputMode="numeric"
        disabled={disabled}
        value={localNumber}
        onChange={handleLocalChange}
        placeholder={`${"0".repeat(selectedCountry.minLen)}`}
        maxLength={selectedCountry.maxLen}
        className={cn(
          "flex h-9 w-full rounded-r-md border border-input bg-background px-3 py-1 text-sm shadow-sm",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
      />

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-10 w-72 rounded-md border border-border bg-popover shadow-md">
          {/* Search */}
          <div className="flex items-center border-b border-border px-3 py-2 gap-2">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search country or code..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")}>
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          {/* Country list */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No countries found</p>
            ) : (
              filtered.map((country) => (
                <button
                  key={country.code}
                  type="button"
                  onClick={() => handleCountrySelect(country)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2 text-sm text-left",
                    "hover:bg-accent hover:text-accent-foreground transition-colors",
                    selectedCountry.code === country.code && "bg-accent text-accent-foreground"
                  )}
                >
                  <span className="text-base leading-none">{country.flag}</span>
                  <span className="flex-1 truncate">{country.name}</span>
                  <span className="text-muted-foreground text-xs shrink-0">+{country.dialCode}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
