import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import {
  type Photo,
  useRerunPhotoAnalysis,
} from "@workspace/api-client-react";

const SCREEN_WIDTH = Dimensions.get("window").width;
const NUM_COLS = 3;
const ITEM_SIZE = (SCREEN_WIDTH - 2) / NUM_COLS;

interface PhotoGridProps {
  photos: Photo[];
  onPhotoPress: (photo: Photo, index: number) => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  ListHeaderComponent?: React.ReactElement;
  ListEmptyComponent?: React.ReactElement;
  ListFooterComponent?: React.ReactElement;
}

interface PhotoItemProps {
  photo: Photo;
  onPress: () => void;
}

function AiBadge({ photo }: { photo: Photo }) {
  const [isRerunning, setIsRerunning] = useState(false);
  const qc = useQueryClient();
  const { mutate: rerunAnalysis } = useRerunPhotoAnalysis();

  if (photo.latestAiStatus === "failed" && !photo.aiDescription) {
    return (
      <Pressable
        style={styles.aiBadge}
        accessibilityLabel={isRerunning ? "Re-running AI analysis" : "AI analysis failed — tap to retry"}
        onPress={() => {
          if (isRerunning) return;
          setIsRerunning(true);
          rerunAnalysis(
            { id: photo.id },
            {
              onSuccess: () => {
                void qc.invalidateQueries({
                  predicate: (query) => {
                    const key = query.queryKey[0];
                    return key === "photos" || key === "album-photos";
                  },
                });
              },
              onSettled: () => setIsRerunning(false),
            }
          );
        }}
      >
        {isRerunning ? (
          <ActivityIndicator size={10} color="#fbbf24" />
        ) : (
          <>
            <Ionicons name="hardware-chip-outline" size={9} color="#fbbf24" />
            <Ionicons name="alert-circle" size={8} color="#fbbf24" />
          </>
        )}
      </Pressable>
    );
  }
  if (photo.aiDescription) {
    return (
      <View style={styles.aiBadge} accessibilityLabel="AI description available">
        <Ionicons name="hardware-chip-outline" size={9} color="#7dd3fc" />
        <Ionicons name="checkmark" size={8} color="#7dd3fc" />
      </View>
    );
  }
  return null;
}

function PhotoItem({ photo, onPress }: PhotoItemProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.item, { opacity: pressed ? 0.85 : 1 }]}
      testID={`photo-item-${photo.id}`}
    >
      <Image
        source={{ uri: photo.url }}
        style={styles.image}
        contentFit="cover"
        transition={150}
      />
      <AiBadge photo={photo} />
    </Pressable>
  );
}

export function PhotoGrid({
  photos,
  onPhotoPress,
  refreshing,
  onRefresh,
  ListHeaderComponent,
  ListEmptyComponent,
  ListFooterComponent,
}: PhotoGridProps) {
  const keyExtractor = useCallback((item: Photo) => String(item.id), []);

  const renderItem = useCallback(
    ({ item, index }: { item: Photo; index: number }) => (
      <PhotoItem photo={item} onPress={() => onPhotoPress(item, index)} />
    ),
    [onPhotoPress]
  );

  return (
    <FlatList
      data={photos}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      numColumns={NUM_COLS}
      columnWrapperStyle={styles.row}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      ListFooterComponent={ListFooterComponent}
      scrollEnabled={photos.length > 0}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 1,
    marginBottom: 1,
  },
  item: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  aiBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
    backgroundColor: "rgba(0,0,0,0.70)",
    borderRadius: 20,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
});
