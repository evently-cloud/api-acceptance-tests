import {DataTable} from "@cucumber/cucumber"
import assert from "assert"
import {binding, given, then} from "cucumber-tsflow"
import {Ketting, Link, State} from "ketting"
import {Workspace} from "./workspace"



const HOME_PROFILE = "https://level3.rest/profiles/home"


@binding([Workspace])
export class Fetch {

  private ketting: Ketting

  private url = ""

  // @ts-ignore
  private state: State


  public constructor(protected workspace: Workspace) {
    this.ketting = new Ketting(workspace.eventlyUrl)
  }

  @given(/Client GETs ([\w/]+)/)
  public async getUrl(url: string) {
    this.url = url
    this.state = await this.ketting
      .go(this.url)
      .get()
  }

  @then("content is HAL")
  public isHal() {
    const {headers} = this.state
    const contentType = headers.get("content-type")
    assert(contentType?.includes("application/hal+json"))
  }

  @then(/has L3 Home profile/)
  public hasHomeProfile() {
    const {headers} = this.state
    const profiles = headers.get("profile")
    assert(profiles?.includes(HOME_PROFILE), `missing ${HOME_PROFILE} profile header.`)
    const allows = headers.get("allow")
    assert(allows?.includes("GET"), `allow header missing GET: ${allows}`)
    assert(allows?.includes("HEAD"), `allow header missing HEAD: ${allows}`)
  }

  @then(/has links/)
  public hasLinks(data: DataTable) {
    const {links: actual} = this.state
    const expected: Link[] = data.hashes()
    for (const {rel, href, title} of expected) {
      const actualLink = actual.get(rel)
      assert(actualLink, `missing link ${rel}`)
      const {href: actualHref, title: actualTitle} = actualLink
      assert(href === actualHref, `expected href ${href}, actual: ${actualHref}`)
      if (title) {
        assert(title === actualTitle, `expected title ${title}, actual: ${actualTitle}`)
      }
    }
  }
}
