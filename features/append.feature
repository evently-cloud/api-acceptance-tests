Feature: Append Events
  Test all the ways to append events

  Scenario: Prepare for tests
    Given Authenticated Client resets ledger
    And Authenticated Client registers event 'Item Stocked' in entity 'Store'
    And Authenticated Client registers event 'Item Added' in entity 'Cart'
    And Authenticated Client registers event 'Item Removed' in entity 'Cart'
    And Authenticated Client registers event 'Cart Purchased' in entity 'Cart'


  Scenario: Cannot append unregistered event
    Given Authenticated Client fails to append fact 'Store/Alarm Triggered', key 'Vancouver', meta '{}' and data '{}' because '403'


  Scenario: Append facts
    Given Authenticated Client appends facts
      | entity  | event               | key       | meta              | data                        |
      | Store   | Item Stocked        | Vancouver | {"actor":"Ami"}   | {"sku":"Fudge_Brownie"}     |
      | Store   | Item Stocked        | Vancouver | {"actor":"Ami"}   | {"sku":"Fudge_Brownie"}     |
      | Store   | Item Stocked        | Vancouver | {"actor":"Ami"}   | {"sku":"Chocolate_Cookie"}  |
      | Store   | Item Stocked        | Vancouver | {"actor":"Marc"}  | {"sku":"Peanuts"}           |
      | Store   | Item Stocked        | Vancouver | {"actor":"Marc"}  | {"sku":"Carrots"}           |


  Scenario: Append events serially
    Given Authenticated Client appends fact 'Cart/Item Added', key '1', meta '{}' and data '{"sku":"Peanuts"}'



## idempotent appends too
