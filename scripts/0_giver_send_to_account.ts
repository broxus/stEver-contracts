import { Address } from "locklift";

export const giverSendToAccount = async () => {
  await locklift.giver.sendTo(
    new Address("0:ebdfb5fbb1615240d72ada4cdba95759c7ac721eeefc31137859dd7eda2f56c7"),
    locklift.utils.toNano(10),
  );
};

giverSendToAccount()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
