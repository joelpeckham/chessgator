import Image from "next/image";

export function ChessgatorWordmark() {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Image
        src="/chessgator-logo.svg"
        alt=""
        width={246}
        height={409}
        className="h-10 w-auto"
        draggable={false}
      />
      <p className="font-heading text-base font-semibold tracking-tight sm:text-lg">
        chessgator
      </p>
    </div>
  );
}
