import type { ReactNode } from "react";

type PageContainerProps = {
  children: ReactNode;
  className?: string;
};

export function PageContainer({
  children,
  className = "",
}: PageContainerProps) {
  return (
    <div className={`max-w-[1600px] mx-auto px-6 md:px-10 ${className}`}>
      {children}
    </div>
  );
}
