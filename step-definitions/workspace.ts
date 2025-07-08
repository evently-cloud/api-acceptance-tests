import assert from "assert"
import {Ketting} from "ketting"


// Workspace is constructed for every scenario
export class Workspace {

  public readonly eventlyUrl = process.env.EVENTLY_URL || ""

  public adminKetting: Ketting | undefined = undefined
  public registrarKetting: Ketting | undefined = undefined
  public publicKetting: Ketting | undefined = undefined
  public clientKetting: Ketting | undefined = undefined

  public getAdmin(): Ketting {
    assert.ok(this.adminKetting !== undefined, "admin ketting must be defined")
    return this.adminKetting
  }

  public getRegistrar(): Ketting {
    assert.ok(this.registrarKetting !== undefined, "registrar ketting must be defined")
    return this.registrarKetting
  }

  public getPublic(): Ketting {
    assert.ok(this.publicKetting !== undefined, "public ketting must be defined")
    return this.publicKetting
  }

  public getClient(): Ketting {
    assert.ok(this.clientKetting !== undefined, "client ketting must be defined")
    return this.clientKetting
  }
}
