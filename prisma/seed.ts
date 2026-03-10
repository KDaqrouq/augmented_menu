import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const restaurant = await prisma.restaurant.upsert({
    where: { slug: "demo" },
    update: {},
    create: {
      name: "Demo Restaurant",
      slug: "demo",
    },
  });

  const starters = await prisma.menuCategory.upsert({
    where: { id: "demo-cat-starters" },
    update: {},
    create: {
      id: "demo-cat-starters",
      restaurantId: restaurant.id,
      name: "Starters",
      sortOrder: 0,
    },
  });

  const mains = await prisma.menuCategory.upsert({
    where: { id: "demo-cat-mains" },
    update: {},
    create: {
      id: "demo-cat-mains",
      restaurantId: restaurant.id,
      name: "Mains",
      sortOrder: 1,
    },
  });

  await prisma.menuItem.upsert({
    where: { id: "demo-item-1" },
    update: {},
    create: {
      id: "demo-item-1",
      restaurantId: restaurant.id,
      categoryId: starters.id,
      name: "Demo Salad",
      description: "Phase 1 seed item.",
      price: "9.00",
      measurementType: "PLATE_DIAMETER_CM",
      measurementValue: 28,
      arAssetVersion: 0,
    },
  });

  await prisma.menuItem.upsert({
    where: { id: "demo-item-2" },
    update: {},
    create: {
      id: "demo-item-2",
      restaurantId: restaurant.id,
      categoryId: mains.id,
      name: "Demo Plate",
      description: "Another seed item for menu API.",
      price: "18.00",
      measurementType: "PLATE_DIAMETER_CM",
      measurementValue: 30,
      arAssetVersion: 0,
    },
  });

  console.log("Seed complete: restaurant", restaurant.slug, "with categories and items.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
