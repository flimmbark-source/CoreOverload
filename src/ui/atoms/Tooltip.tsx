import React, {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useId,
  useState,
} from "react";

export type TooltipProps = {
  label: ReactNode;
  children: ReactElement;
  className?: string;
};

export const Tooltip: React.FC<TooltipProps> = ({ label, children, className }) => {
  const [visible, setVisible] = useState(false);
  const tooltipId = useId();

  const show = () => setVisible(true);
  const hide = () => setVisible(false);

  const describedByTokens = isValidElement(children)
    ? [children.props["aria-describedby"], tooltipId].filter(
        (token): token is string => Boolean(token)
      )
    : [tooltipId];

  const trigger = isValidElement(children)
    ? cloneElement(children, {
        onFocus: (event: React.FocusEvent<HTMLElement>) => {
          children.props.onFocus?.(event);
          show();
        },
        onBlur: (event: React.FocusEvent<HTMLElement>) => {
          children.props.onBlur?.(event);
          hide();
        },
        onMouseEnter: (event: React.MouseEvent<HTMLElement>) => {
          children.props.onMouseEnter?.(event);
          show();
        },
        onMouseLeave: (event: React.MouseEvent<HTMLElement>) => {
          children.props.onMouseLeave?.(event);
          hide();
        },
        "aria-describedby": describedByTokens.join(" "),
      })
    : children;

  return (
    <span className={`relative inline-flex ${className ?? ""}`}>
      {trigger}
      <span
        role="tooltip"
        id={tooltipId}
        aria-hidden={visible ? undefined : true}
        className={`pointer-events-none absolute left-1/2 top-full z-30 -translate-x-1/2 rounded-md border border-slate-700 bg-slate-900/95 px-2 py-1 text-[10px] text-slate-100 shadow-lg transition-all duration-150 ${
          visible ? "opacity-100 translate-y-1" : "opacity-0 translate-y-1.5"
        }`}
      >
        {label}
      </span>
    </span>
  );
};
