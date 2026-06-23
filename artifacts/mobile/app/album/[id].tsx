import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useNavigation } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useGetAlbum, useListAlbumPhotos, type Photo } from "@workspace/api-client-react";
import { EmptyState } from "@/components/EmptyState";
import { PhotoGrid } from "@/components/PhotoGrid";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { useColors } from "@/hooks/useColors";
import { usePhotoUpload } from "@/hooks/usePhotoUpload";

export default function AlbumDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const colors = useColors();

  const albumId = Number(id);

  const {
    data: album,
    isLoading: albumLoading,
  } = useGetAlbum(albumId, {
    query: { queryKey: ["album", albumId] },
  });

  const {
    data: photos,
    isLoading: photosLoading,
    refetch,
    isRefetching,
  } = useListAlbumPhotos(albumId, undefined, {
    query: { queryKey: ["album-photos", albumId] },
  });

  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const { showPicker, isUploading } = usePhotoUpload({
    albumId,
    onSuccess: () => {
      void refetch();
    },
    onError: (err) => {
      Alert.alert("Upload failed", err.message);
    },
  });

  useEffect(() => {
    if (album?.title) {
      navigation.setOptions({
        title: album.title,
        headerRight: () => (
          <Pressable
            onPress={showPicker}
            disabled={isUploading}
            style={({ pressed }) => [
              styles.headerButton,
              pressed && styles.headerButtonPressed,
            ]}
            accessibilityLabel="Upload photo"
            accessibilityRole="button"
          >
            {isUploading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="add" size={28} color={colors.primary} />
            )}
          </Pressable>
        ),
      });
    }
  }, [album?.title, navigation, showPicker, isUploading, colors.primary]);

  const allPhotos = photos ?? [];

  const handlePhotoPress = useCallback((_: Photo, index: number) => {
    setLightboxIndex(index);
    setLightboxVisible(true);
  }, []);

  const isLoading = albumLoading || photosLoading;

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PhotoGrid
        photos={allPhotos}
        onPhotoPress={handlePhotoPress}
        refreshing={isRefetching}
        onRefresh={refetch}
        ListHeaderComponent={
          album?.description ? (
            <View style={[styles.descContainer, { borderBottomColor: colors.border }]}>
              <Text style={[styles.desc, { color: colors.mutedForeground }]}>
                {album.description}
              </Text>
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          <EmptyState
            icon="camera-outline"
            title="No photos in this album"
            subtitle="Photos will appear here once they're uploaded"
          />
        }
        ListFooterComponent={
          <View style={{ height: Platform.OS === "web" ? 84 : 16 }} />
        }
      />
      {lightboxVisible && allPhotos.length > 0 && (
        <PhotoLightbox
          photos={allPhotos}
          initialIndex={lightboxIndex}
          visible={lightboxVisible}
          onClose={() => setLightboxVisible(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  descContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    marginBottom: 1,
  },
  desc: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    lineHeight: 20,
  },
  headerButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  headerButtonPressed: {
    opacity: 0.5,
  },
});
