import { StoryComposer } from "@/components/StoryComposer";
import { StoryViewer } from "@/components/StoryViewer";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useConvex } from "convex/react";
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { Alert, View } from "react-native";

export interface OpenStoriesOptions {
  /** Почати з конкретної історії (глибоке посилання, цитата в чаті). */
  storyId?: Id<"stories">;
  /** Показати «підбірки» (збережені історії) користувача замість активних. */
  highlights?: boolean;
  /** Мій архів: завершені історії (лише власнику). */
  archive?: boolean;
}

interface StoriesUi {
  /** Відкриває повноекранний переглядач, починаючи з історій цього користувача (далі — наступні). */
  openStories: (userId: Id<"users">, options?: OpenStoriesOptions) => void;
  /** Відкриває історію за id (посилання modesto://s/<id>); якщо недоступна — повідомляє. */
  openStoryById: (storyId: Id<"stories">) => Promise<void>;
  /** Відкриває створення історії (камера/галерея). */
  openComposer: () => void;
}

const Ctx = createContext<StoriesUi | null>(null);

export function useStories(): StoriesUi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStories має використовуватись усередині StoriesProvider");
  return ctx;
}

interface ViewerState extends OpenStoriesOptions {
  userId: Id<"users">;
}

/** Історії: переглядач і створення — оверлеї в дереві (без RN Modal), над навігатором. */
export function StoriesProvider({ children }: { children: ReactNode }) {
  const convex = useConvex();
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const [composing, setComposing] = useState(false);
  const openStories = useCallback(
    (userId: Id<"users">, options?: OpenStoriesOptions) => setViewer({ userId, ...options }),
    [],
  );
  const openStoryById = useCallback(
    async (storyId: Id<"stories">) => {
      try {
        const info = await convex.query(api.stories.resolve, { storyId });
        if (!info) {
          Alert.alert("Історія недоступна", "Її завершено, видалено або автор обмежив доступ.");
          return;
        }
        setViewer({ userId: info.userId, storyId, highlights: info.expired && info.highlight });
      } catch {
        Alert.alert("Не вдалося відкрити історію");
      }
    },
    [convex],
  );
  const openComposer = useCallback(() => setComposing(true), []);
  const closeViewer = useCallback(() => setViewer(null), []);
  const closeComposer = useCallback(() => setComposing(false), []);
  const value = useMemo(() => ({ openStories, openStoryById, openComposer }), [openStories, openStoryById, openComposer]);

  return (
    <Ctx.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        {viewer ? (
          <StoryViewer
            startUserId={viewer.userId}
            focusStoryId={viewer.storyId}
            highlights={viewer.highlights}
            archive={viewer.archive}
            onClose={closeViewer}
          />
        ) : null}
        {composing ? <StoryComposer onClose={closeComposer} /> : null}
      </View>
    </Ctx.Provider>
  );
}
