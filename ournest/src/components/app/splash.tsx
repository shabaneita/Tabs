import { NestMark } from "../brand";

export function Splash({ message }: { message?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-pulse">
          <NestMark size={64} />
        </div>
        {message ? <p className="text-sm text-foreground-muted">{message}</p> : null}
      </div>
    </div>
  );
}
