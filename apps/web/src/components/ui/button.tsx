import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand-500 text-gray-950 hover:bg-brand-400',
  secondary: 'border border-line bg-raised text-text hover:border-gray-400',
  ghost: 'text-muted hover:text-text',
};

/** Also styles `<a>` and `<Link>` that should look like a button. */
export const buttonStyles = (variant: ButtonVariant = 'primary'): string =>
  `inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[6px] px-5 font-display text-base font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]}`;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export const Button = ({ variant, type = 'button', className = '', ...props }: ButtonProps) => (
  <button type={type} {...props} className={`${buttonStyles(variant)} ${className}`} />
);
