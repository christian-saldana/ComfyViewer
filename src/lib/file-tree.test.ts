import { buildFileTree } from "./file-tree";
import { StoredImage } from "./image-db";

// Mock StoredImage type for testing purposes
const createMockImage = (
  id: number,
  path: string,
  lastModified: number
): StoredImage => ({
  id,
  webkitRelativePath: path,
  name: path.split("/").pop() || "",
  lastModified,
  type: "image/png",
  size: 1024,
  width: 1024,
  height: 1024,
  thumbnail: "",
  workflow: null,
  prompt: null,
  negativePrompt: null,
  seed: null,
  cfg: null,
  steps: null,
  sampler: null,
  scheduler: null,
  model: null,
  loras: [],
});

describe("buildFileTree", () => {
  it("should return null for empty or invalid input", () => {
    expect(buildFileTree([])).toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(buildFileTree(null as any)).toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(buildFileTree(undefined as any)).toBeNull();
  });

  it("should build a simple tree with one folder and one file", () => {
    const files = [createMockImage(1, "root/image1.png", 1000)];
    const tree = buildFileTree(files);

    expect(tree).not.toBeNull();
    expect(tree?.name).toBe("root");
    expect(tree?.children.length).toBe(1);
    expect(tree?.children[0].type).toBe("file");
    expect(tree?.children[0].name).toBe("image1.png");
  });

  it("should correctly structure nested folders", () => {
    const files = [
      createMockImage(1, "root/sub/image1.png", 1000),
      createMockImage(2, "root/image2.png", 2000),
    ];
    const tree = buildFileTree(files);

    expect(tree?.name).toBe("root");
    const rootChildren = tree?.children || [];
    expect(rootChildren.length).toBe(2);

    const subFolder = rootChildren.find((n) => n.type === "folder");
    const rootFile = rootChildren.find((n) => n.type === "file");

    expect(subFolder?.name).toBe("sub");
    expect(rootFile?.name).toBe("image2.png");

    const subChildren = subFolder?.children || [];
    expect(subChildren.length).toBe(1);
    expect(subChildren[0].name).toBe("image1.png");
  });

  it("should sort children with folders first, then by date descending", () => {
    const files = [
      createMockImage(1, "root/image_old.png", 1000),
      createMockImage(2, "root/folder_new/image.png", 3000),
      createMockImage(3, "root/image_new.png", 2000),
      createMockImage(4, "root/folder_old/image.png", 500),
    ];
    const tree = buildFileTree(files);
    const children = tree?.children || [];

    expect(children.map((c) => c.name)).toEqual([
      "folder_new",
      "folder_old",
      "image_new.png",
      "image_old.png",
    ]);
  });

  it("should update folder lastModified date to the newest child's date", () => {
    const files = [
      createMockImage(1, "root/sub/image_new.png", 3000),
      createMockImage(2, "root/sub/image_old.png", 1000),
      createMockImage(3, "root/image_root.png", 2000),
    ];
    const tree = buildFileTree(files);

    const subFolder = tree?.children.find((c) => c.name === "sub");
    expect(subFolder?.lastModified).toBe(3000);
    expect(tree?.lastModified).toBe(3000); // Root folder should also be updated
  });
});