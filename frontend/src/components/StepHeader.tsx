import type { ReactNode } from "react";

interface StepHeaderProps {
  step: number;
  title: string;
  description?: ReactNode;
  inactive?: boolean;
  className?: string;
  /** 1画面表示で縦が窮屈な箇所では説明文を隠す等に使う */
  descriptionClassName?: string;
}

export const StepHeader = ({
  step,
  title,
  description,
  inactive = false,
  className = "",
  descriptionClassName = "",
}: StepHeaderProps) => (
  <div className={`section-title ${className}`}>
    <span className={`step-badge ${inactive ? "step-badge-inactive" : ""}`}>{step}</span>
    <div className="min-w-0">
      <h2>{title}</h2>
      {description && <p className={descriptionClassName}>{description}</p>}
    </div>
  </div>
);
