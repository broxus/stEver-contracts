# StEver

StEver is a staking platform that aggregates real network validators in one place. This platform
has the ability to automatically balance between validators.

### This project resolves problems:
1. Users shouldn't select a validator for them self
2. Users shouldn't freeze their money, after stake user will receive StEver tokens based on the current rate

 
## Deploy
```shell
npm i
```
```shell
SEED="{{seed phrase}}" \
MAIN_GIVER_KEY={{giver secret key}} \
npx locklift run --disable-build --network mainnet -s scripts/1_deploy-and-setup-stEverVault.ts
```
### Deploy params:
1. **MultiSig admin(owner) wallet address**: StEverVault owner
2. **TokeRoot address**: StEver token root address
2. **Governance PUBLIC key**: bot public key
3. **StEverVault deploy value (ever), min 100 ever**
4. **GainFee (ever)**: StEverVault will take gainFee from each strategy report to maintain the required gas level **(1 ever is recommended)**
5. **StEver platform fee (0..1000), 1% == 10**: This fee will aggregate (as a platform fee) for future withdrawal to the admin

## Validator integration


