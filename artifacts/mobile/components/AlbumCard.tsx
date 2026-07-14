import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Album } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

interface AlbumCardProps {
  album: Album;
  onPress: () => void;
}

export function AlbumCard({ album, onPress }: AlbumCardProps) {
  const colors = useColors();
  const coverUrl = album.coverPhotoThumbnailKey
    ? `/api/storage${album.coverPhotoThumbnailKey}`
    : album.coverPhotoUrl ?? null;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
      onPress={onPress}
      testID={`album-card-${album.id}`}
    >
      <View style={styles.imageContainer}>
        {coverUrl ? (
          <Image
            source={{ uri: coverUrl }}
            style={styles.image}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.placeholder, { backgroundColor: colors.muted }]}>
            <Ionicons name="images-outline" size={32} color={colors.mutedForeground} />
          </View>
        )}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.6)"]}
          style={styles.gradient}
        />
        <View style={styles.overlay}>
          <Text style={styles.title} numberOfLines={1}>
            {album.title}
          </Text>
          {album.eventDate && (
            <Text style={styles.date}>
              {new Date(album.eventDate).toLocaleDateString("en-US", {
                month: "short",
                day: "2-digit",
                year: "numeric",
              })}
            </Text>
          )}
          <Text style={styles.photoCount}>
            {album.photoCount} {album.photoCount === 1 ? "photo" : "photos"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    flex: 1,
  },
  imageContainer: {
    height: 180,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  gradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 90,
  },
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
  },
  title: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  date: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    marginTop: 2,
  },
  photoCount: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    marginTop: 1,
  },
});
