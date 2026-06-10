import type { FC, ImgHTMLAttributes } from "react";

interface FaryneLogoProps extends Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src" | "width" | "height"
> {
  /** Desired rendered width in pixels */
  width?: number;
  /** Alt text for accessibility */
  alt?: string;
}

export const FaryneLogo: FC<FaryneLogoProps> = ({
  width = 32,
  alt = "Faryne",
  ...props
}) => {
  // Choose the most appropriate source image based on requested size
  // Using smaller sources for small logos improves loading performance
  let src: string;

  if (width <= 64) {
    src = "/faryne-logo-64.png";
  } else if (width <= 128) {
    src = "/faryne-logo-128.png";
  } else if (width <= 256) {
    src = "/faryne-logo-256.png";
  } else {
    // For very large uses, fall back to the highest resolution master
    src = "/faryne-logo-1024.png";
  }

  return (
    <img
      src={src}
      width={width}
      height={width}
      alt={alt}
      loading="lazy"
      decoding="async"
      {...props}
    />
  );
};
