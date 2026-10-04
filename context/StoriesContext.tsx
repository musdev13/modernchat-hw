import { StoryComposer } from "@/components/StoryComposer";
import { StoryViewer } from "@/components/StoryViewer";
import { Id } from "@/convex/_generated/dataModel";
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { View } from "react-native";

interface StoriesUi {
  /** Відкриває повноекранний переглядач, починаючи з історій цього користувача (далі — наступні). */
  openStories: (userId: Id<"users">) => void;
  /** Відкриває створення історії (камера/галерея). */
  openComposer: () => void;
}

const Ctx = createContext<StoriesUi | null>(null);

export function useStories(): StoriesUi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStories має використовуватись усередині StoriesProvider");
  return ctx;
}

/** Історії: переглядач і створення — оверлеї в дереві (без RN Modal), над навігатором. */
export function StoriesProvider({ children }: { children: ReactNode }) {
  const [viewerUser, setViewerUser] = useState<Id<"users"> | null>(null);
  const [composing, setComposing] = useState(false);
  const openStories = useCallback((userId: Id<"users">) => setViewerUser(userId), []);
  const openComposer = useCallback(() => setComposing(true), []);
  const closeViewer = useCallback(() => setViewerUser(null), []);
  const closeComposer = useCallback(() => setComposing(false), []);
  const value = useMemo(() => ({ openStories, openComposer }), [openStories, openComposer]);

  return (
    <Ctx.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        {viewerUser ? <StoryViewer startUserId={viewerUser} onClose={closeViewer} /> : null}
        {composing ? <StoryComposer onClose={closeComposer} /> : null}
      </View>
    </Ctx.Provider>
  );
}
