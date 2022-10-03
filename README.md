# StEverVault

## Deploy
```shell
SEED="{{seed phrase of MultiSig admin(owner) wallet}}" \
MAIN_GIVER_KEY={{giver secret key}} \
npx locklift run --disable-build --network mainnet -s scripts/1_deploy-and-setup-stEverVault.ts
```
### Deploy params:
1. **MultiSig admin(owner) wallet address**: StEverVault owner
2. **Governance PUBLIC key**: bot public key
3. **StEverVault deploy value (ever), min 100 ever**
4. **GainFee (ever)**: StEverVault will take gainFee from each strategy report to maintain the required gas level **(1 ever is recommended)**
5. **StEver platform fee (0..100%)**: This fee will aggregate (as a platform fee) for future withdrawal to the admin
