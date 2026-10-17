// Lets mouse users drag horizontal carousels sideways, the way touch users swipe.
// Pass as the `ref` of a horizontal ScrollView or FlatList.

// Movement below this many pixels still counts as a click on a card
const DRAG_THRESHOLD = 5;

const prepared = new WeakSet<HTMLElement>();

export function dragScroll(list: { getScrollableNode?: () => HTMLElement | null } | null) {
  const node = list?.getScrollableNode?.();
  if (!node || prepared.has(node)) return;
  prepared.add(node);

  let startX = 0;
  let startScroll = 0;
  let dragged = false;

  const onMove = (event: MouseEvent) => {
    const distance = event.clientX - startX;
    if (Math.abs(distance) > DRAG_THRESHOLD) dragged = true;
    if (dragged) node.scrollLeft = startScroll - distance;
  };

  const onUp = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    node.style.cursor = "";
  };

  node.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    // Keeps the browser from selecting text or dragging cover images
    event.preventDefault();
    startX = event.clientX;
    startScroll = node.scrollLeft;
    dragged = false;
    node.style.cursor = "grabbing";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });

  // A drag ends with a click on whichever card is under the mouse; that click
  // belongs to the drag, so the card stays closed
  node.addEventListener(
    "click",
    (event) => {
      if (!dragged) return;
      event.preventDefault();
      event.stopPropagation();
      dragged = false;
    },
    true,
  );
}
