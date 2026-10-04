import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";
import { Text } from "react-native";

type HeartParticleProps = {
  index: number;
  originX: number;
  originY: number;
  width: number;
  height: number;
};

function HeartParticle({
  index,
  originX,
  originY,
  width,
  height,
}: HeartParticleProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(0);
  const opacity = useSharedValue(1);
  const rotation = useSharedValue(0);

  useEffect(() => {
    const angle = (Math.PI * 2 * index) / 8 + (index % 2) * 0.11;
    const reach = Math.max(width, height) * (0.32 + (index % 3) * 0.08);
    translateX.value = withTiming(Math.cos(angle) * reach, {
      duration: 760,
      easing: Easing.out(Easing.cubic),
    });
    translateY.value = withTiming(Math.sin(angle) * reach - 24, {
      duration: 760,
      easing: Easing.out(Easing.cubic),
    });
    scale.value = withTiming(0.9 + (index % 3) * 0.12, { duration: 150 });
    opacity.value = withTiming(0, {
      duration: 760,
      easing: Easing.out(Easing.quad),
    });
    rotation.value = withTiming((index % 2 === 0 ? 1 : -1) * 140, {
      duration: 760,
      easing: Easing.out(Easing.cubic),
    });
  }, [
    height,
    index,
    opacity,
    originX,
    originY,
    rotation,
    scale,
    translateX,
    translateY,
    width,
  ]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: originX - 13,
          top: originY - 13,
          zIndex: 100,
          pointerEvents: "none",
        },
        style,
      ]}
    >
      <Text style={{ fontSize: index % 4 === 0 ? 30 : 24 }}>
        {index % 4 === 0 ? "💖" : "❤️"}
      </Text>
    </Animated.View>
  );
}

export function HeartBurst({
  id,
  x,
  y,
  width,
  height,
}: {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  return (
    <>
      {Array.from({ length: 8 }, (_, index) => (
        <HeartParticle
          key={`${id}-${index}`}
          index={index}
          originX={x}
          originY={y}
          width={width}
          height={height}
        />
      ))}
    </>
  );
}
