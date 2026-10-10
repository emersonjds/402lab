import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-lime text-bg hover:bg-lime/90',
  secondary: 'border border-line bg-raised text-text hover:border-muted',
  ghost: 'text-muted hover:text-text',
};

/** Also styles `<a>` and `<Link>` that look like buttons. */
export const buttonStyles = (variant: ButtonVariant = 'primary'): string =>
  `inline-flex min-h-11 cursor-pointer items-center whitespace-nowrap justify-center gap-2 rounded-card px-5 font-display text-base font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]}`;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export const Button = ({ variant, type = 'button', ...props }: ButtonProps) => (
  <button type={type} {...props} className={buttonStyles(variant)} />
);
