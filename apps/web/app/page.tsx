import { GameApp } from "@/components/GameApp";
import { PointerDragProvider } from "@/lib/PointerDragContext";

export default function HomePage() {
  return (
    <PointerDragProvider>
      <GameApp />
    </PointerDragProvider>
  );
}
