import type { Actress } from "@/types/av.ts";

export interface IActressSummary {
  actress: Actress;
  onClick?: (v: Actress) => void;
}

export function ActressSummary(props: IActressSummary) {
  return (
    <a
      href={"#"}
      onClick={(e) => {
        e.preventDefault();
        props.onClick?.(props.actress);
      }}
    >
      <img
        src={props.actress.photo}
        alt={props.actress.name}
        title={props.actress.name}
        style={{ maxWidth: "120px" }}
      />
    </a>
  );
}
