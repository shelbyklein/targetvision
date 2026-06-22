import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { Photo } from "@workspace/api-client-react";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

interface PhotoLightboxProps {
  photos: Photo[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= Math.round(rating) ? "star" : "star-outline"}
          size={14}
          color={
            star <= Math.round(rating) ? "#f59e0b" : "rgba(255,255,255,0.4)"
          }
          style={{ marginRight: 2 }}
        />
      ))}
      <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
    </View>
  );
}

export function PhotoLightbox({
  photos,
  initialIndex,
  visible,
  onClose,
}: PhotoLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      translateX.setValue(0);
      opacity.setValue(1);
    }
  }, [visible, initialIndex]);

  const goTo = useCallback(
    (nextIndex: number) => {
      if (nextIndex < 0 || nextIndex >= photos.length) return;
      const direction = nextIndex > currentIndex ? -1 : 1;

      Animated.parallel([
        Animated.timing(translateX, {
          toValue: direction * SCREEN_WIDTH,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setCurrentIndex(nextIndex);
        translateX.setValue(-direction * SCREEN_WIDTH * 0.3);
        Animated.parallel([
          Animated.spring(translateX, {
            toValue: 0,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
        ]).start();
      });
    },
    [currentIndex, photos.length, translateX, opacity]
  );

  const currentIndexRef = useRef(currentIndex);
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
          Math.abs(gestureState.dx) > 10
        );
      },
      onPanResponderMove: (_, gestureState) => {
        translateX.setValue(gestureState.dx * 0.5);
      },
      onPanResponderRelease: (_, gestureState) => {
        const idx = currentIndexRef.current;
        if (gestureState.dx < -SWIPE_THRESHOLD) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          if (idx + 1 < photos.length) {
            goTo(idx + 1);
          } else {
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
            }).start();
          }
        } else if (gestureState.dx > SWIPE_THRESHOLD) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          if (idx - 1 >= 0) {
            goTo(idx - 1);
          } else {
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
            }).start();
          }
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const photo = photos[currentIndex];
  if (!photo) return null;

  const hasRating =
    typeof photo.averageRating === "number" && photo.averageRating > 0;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={styles.container} {...panResponder.panHandlers}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={12}
              testID="lightbox-close"
            >
              <Ionicons name="close" size={26} color="#fff" />
            </Pressable>
            <Text style={styles.counter}>
              {currentIndex + 1} / {photos.length}
            </Text>
            <View style={{ width: 44 }} />
          </View>
        </SafeAreaView>

        <Animated.View
          style={[styles.imageWrapper, { transform: [{ translateX }], opacity }]}
        >
          <Image
            source={{ uri: photo.url }}
            style={styles.image}
            contentFit="contain"
            transition={100}
            testID="lightbox-image"
          />
        </Animated.View>

        <SafeAreaView style={styles.bottomSafeArea}>
          <View style={styles.infoBar}>
            {hasRating && <StarRating rating={photo.averageRating!} />}
            {photo.aiDescription ? (
              <Text style={styles.aiDesc} numberOfLines={2}>
                {photo.aiDescription}
              </Text>
            ) : null}
            {photo.albumTitle ? (
              <Text style={styles.albumLabel} numberOfLines={1}>
                {photo.albumTitle}
              </Text>
            ) : null}
          </View>
        </SafeAreaView>

        {currentIndex > 0 && (
          <Pressable
            style={[styles.navBtn, styles.navLeft]}
            onPress={() => goTo(currentIndex - 1)}
            hitSlop={8}
            testID="lightbox-prev"
          >
            <View style={styles.navCircle}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </View>
          </Pressable>
        )}
        {currentIndex < photos.length - 1 && (
          <Pressable
            style={[styles.navBtn, styles.navRight]}
            onPress={() => goTo(currentIndex + 1)}
            hitSlop={8}
            testID="lightbox-next"
          >
            <View style={styles.navCircle}>
              <Ionicons name="chevron-forward" size={22} color="#fff" />
            </View>
          </Pressable>
        )}

        {photos.length <= 20 && (
          <View style={styles.dotRow}>
            {photos.map((_, i) => (
              <Pressable key={i} onPress={() => goTo(i)}>
                <View
                  style={[
                    styles.dot,
                    i === currentIndex ? styles.dotActive : styles.dotInactive,
                  ]}
                />
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  safeArea: {
    position: "absolute",
    top: Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  bottomSafeArea: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  counter: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
  },
  imageWrapper: {
    flex: 1,
  },
  image: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  infoBar: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 8,
    gap: 4,
  },
  aiDesc: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontStyle: "italic",
  },
  albumLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  ratingText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    marginLeft: 4,
  },
  navBtn: {
    position: "absolute",
    top: "50%",
    marginTop: -24,
    zIndex: 5,
  },
  navLeft: {
    left: 12,
  },
  navRight: {
    right: 12,
  },
  navCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  dotRow: {
    position: "absolute",
    bottom: 90,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    zIndex: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    backgroundColor: "#ffffff",
  },
  dotInactive: {
    backgroundColor: "rgba(255,255,255,0.35)",
  },
});
