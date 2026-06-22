import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useListAlbums, type Album } from "@workspace/api-client-react";
import { AlbumCard } from "@/components/AlbumCard";
import { EmptyState } from "@/components/EmptyState";
import { useColors } from "@/hooks/useColors";

export default function AlbumsScreen() {
  const colors = useColors();
  const {
    data: albums,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useListAlbums({
    query: { queryKey: ["albums"] },
  });

  const handleAlbumPress = useCallback((album: Album) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/album/${album.id}`);
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
          title="Couldn't load albums"
          subtitle="Check your connection and pull to refresh"
        />
      </View>
    );
  }

  const data = albums ?? [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={data}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[
          styles.list,
          Platform.OS === "web" && { paddingTop: 67 },
        ]}
        refreshing={isRefetching}
        onRefresh={refetch}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!!data.length}
        ListEmptyComponent={
          <EmptyState
            icon="images-outline"
            title="No albums yet"
            subtitle="Albums will appear here once they're created"
          />
        }
        renderItem={({ item }) => (
          <AlbumCard album={item} onPress={() => handleAlbumPress(item)} />
        )}
        ListFooterComponent={<View style={{ height: Platform.OS === "web" ? 34 : 16 }} />}
      />
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
  list: {
    padding: 12,
    gap: 12,
  },
  row: {
    gap: 12,
  },
});
