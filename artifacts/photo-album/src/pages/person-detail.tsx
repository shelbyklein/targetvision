import SmartCollectionDetail from "./smart-collection-detail";

// A person's page IS the smart-collection experience (members first, more
// photos of them by similarity) with person-flavoured chrome.
export default function PersonDetail() {
  return <SmartCollectionDetail variant="person" />;
}
