import { Image } from "expo-image";
import React, { useCallback } from "react";
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import type { Photo } from "@workspace/api-client-react";

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
});
