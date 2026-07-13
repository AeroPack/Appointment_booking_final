import React from 'react';

export interface PasswordStrengthProps {
  password: string;
}

interface StrengthResult {
  score: number;
  label: string;
  color: string;
  bgColor: string;
}

export function getPasswordStrength(password: string): StrengthResult {
  if (!password) {
    return { score: 0, label: '', color: '', bgColor: '' };
  }

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  // Cap at 5 for the bar width calc
  const capped = Math.min(score, 5);

  if (score <= 2) {
    return { score: capped, label: 'Weak', color: 'text-red-600', bgColor: 'bg-red-500' };
  }
  if (score <= 3) {
    return { score: capped, label: 'Fair', color: 'text-yellow-600', bgColor: 'bg-yellow-500' };
  }
  return { score: capped, label: 'Strong', color: 'text-green-600', bgColor: 'bg-green-500' };
}

export const PasswordStrength: React.FC<PasswordStrengthProps> = ({ password }) => {
  const strength = getPasswordStrength(password);

  if (!password) return null;

  const pct = (strength.score / 5) * 100;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${strength.bgColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={`text-[12px] font-medium ${strength.color}`}>
          {strength.label}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Use 8+ characters with uppercase, lowercase, numbers and symbols.
      </p>
    </div>
  );
};
