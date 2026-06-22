import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  View,
} from "react-native";

import { useListPhotos, type Photo } from "@workspace/api-client-react";
import { EmptyState } from "@/components/EmptyState";
import { PhotoGrid } from "@/components/PhotoGrid";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { useColors } from "@/hooks/useColors";

export default function PhotosScreen() {
  const colors = useColors();
  const {
    data: photos,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useListPhotos({
    query: { queryKey: ["photos"] },
  });

  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const allPhotos = photos ?? [];

  const handlePhotoPress = useCallback((_: Photo, index: number) => {
    setLightboxIndex(index);
    setLightboxVisible(true);
  }, []);

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load photos"
          subtitle="Check your connection and pull to refresh"
        />
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
        ListEmptyComponent={
          <EmptyState
            icon="camera-outline"
            title="No photos yet"
            subtitle="Photos will appear here once they're uploaded"
          />
        }
        ListFooterComponent={
          <View style={{ height: Platform.OS === "web" ? 84 : 0 }} />
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
});
