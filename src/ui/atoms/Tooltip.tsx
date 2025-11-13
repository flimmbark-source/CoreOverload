import React, {
  cloneElement,
  isValidElement,
  type FocusEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  useId,
  useState,
} from "react";

type TooltipChildEvents = {
  onFocus?: (event: FocusEvent<HTMLElement>) => void;
  onBlur?: (event: FocusEvent<HTMLElement>) => void;
  onMouseEnter?: (event: MouseEvent<HTMLElement>) => void;
  onMouseLeave?: (event: MouseEvent<HTMLElement>) => void;
  "aria-describedby"?: string;
};

type TooltipChildElement = ReactElement<TooltipChildEvents & Record<string, unknown>>;

const isTooltipChildElement = (node: ReactNode): node is TooltipChildElement =>
  isValidElement(node);

export type TooltipProps = {
  label: ReactNode;
  children: ReactNode;
  className?: string;
};

export const Tooltip: React.FC<TooltipProps> = ({ label, children, className }) => {
  const [visible, setVisible] = useState(false);
  const tooltipId = useId();

  const show = () => setVisible(true);
  const hide = () => setVisible(false);

  const clonableChild = isTooltipChildElement(children) ? children : null;

  const describedByTokens = clonableChild
    ? [(clonableChild.props as TooltipChildEvents)["aria-describedby"], tooltipId].filter(
        (token): token is string => Boolean(token),
      )
    : [tooltipId];

  const trigger = clonableChild
    ? cloneElement(
        clonableChild,
        {
          onFocus: (event: FocusEvent<HTMLElement>) => {
            (clonableChild.props as TooltipChildEvents).onFocus?.(event);
            show();
          },
          onBlur: (event: FocusEvent<HTMLElement>) => {
            (clonableChild.props as TooltipChildEvents).onBlur?.(event);
            hide();
          },
          onMouseEnter: (event: MouseEvent<HTMLElement>) => {
            (clonableChild.props as TooltipChildEvents).onMouseEnter?.(event);
            show();
          },
          onMouseLeave: (event: MouseEvent<HTMLElement>) => {
            (clonableChild.props as TooltipChildEvents).onMouseLeave?.(event);
            hide();
          },
          "aria-describedby": describedByTokens.join(" "),
        } satisfies TooltipChildEvents,
      )
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
