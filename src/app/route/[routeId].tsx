import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function RouteScreen() {
  return (
    <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ThemedText>Route preview — coming in Wave 4</ThemedText>
    </ThemedView>
  );
}
