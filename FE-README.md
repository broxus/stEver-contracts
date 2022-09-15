# Contracts

1. StEverVault - main staking contract
2. StEverAccount - user account

# Methods

### 1. Deposit

```typescript

const depositAmount = 100000000000 //100 ever
const fee = 2000000000 //2 ever
await StEverVault.methods
  .deposit({
    _amount: depositAmount,
    _nonce: randomNonce,
  })
  .send({
    from: accountAddress,
    amount: depositAmount + fee,
  });

/*
after it we can catch deposit event
    {
      "event": "Deposit",
      "data": {
        "user": accountAddress,
        "depositAmount": depositAmount,
        "receivedStEvers": received StEver tokens
      }
    }
*/
```

### 2. Withdraw

```typescript

const withdrawAmount = 1000000000
const withdrawPayload = await StEverVault.methods
  .encodeDepositPayload({
    _nonce: randomNonce, //randomNonce you can set this nonce as Date.now() for better preview in the FE
    _deposit_owner: userAddress,
  })
  .call();

await UserStEverTokenWallet.methods
  .transfer({
    remainingGasTo: this.account.address,
    deployWalletValue: 0,
    amount: withdrawAmount,
    notify: true,
    recipient: this.vault.vaultContract.address,
    payload: withdrawPayload.depositPayload,
  })
  .send({
    from: this.account.address,
    amount: 3000000000 // 3 ever, 1 ever will freeze until withdraw won't be completed
  })
/*
and then we can catch the event
    {
      "event": "WithdrawRequest",
      "data": {
        "user": userAddress,
        "amount": withdrawAmount,
        "nonce": nonce which was added when we was building a withdrawPayload
      }
    }
 */
```

### 3. Remove withdraw request

```typescript
await StEverVault.methods.removePendingWithdraw({
  _nonce: nonce //nonce from withdraw request
}).send({
  from: this.account.address,
  amount: 2000000000,//2 ever
})
/*
and then we can catch the event
    {
      "event": "WithdrawRequestRemoved",
      "data": {
        "user": userAddress,
        "nonce": nonce from withdraw request
      }
    }
 */
```

### 4. UserData info

```typescript
const { value0: userDataAddress } = await this.vault.vaultContract.methods.getAccountAddress({
  _user: userAddress,
  answerId: 0,
}).call()
const userDataAccount = new ever.Contract('UserDataAbi', userDataAddress)
const { withdrawRequests } = await userDataAccount.methods.withdrawRequests().call()
```

### 5. StEverVault Info

```typescript
const { value0: stEverVaultDetails } = await StEverVault.methods.getDetails({ answerId: 0 }).call()
// calcualting the rate
const stEverToEverRate = stEverVaultDetails.stEverSupply / stEverVaultDetails.totalAssets
// also provided two methods
// get how many stEvers we can get for evers
const { value0: howManyStEverWillReceived } = await StEverVault.methods.getDepositStEverAmount({
  _amount: 1000000000//e.g. 1 ever
}).call()

// get how many evers we can get for stEvers
const { value0: howManyEverWillReceived } = await StEverVault.methods.getWithdrawEverAmount({
  _amount: 1000000000//e.g. 1 stEver
}).call()
```

