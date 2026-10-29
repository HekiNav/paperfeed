import { parseFeed, type AnyFeed } from "feedsmith"
import "./style.css"

const COLUMN_WIDTH = 200 //px

export type ParagraphContent = {
    type: "paragraph",
    text: string
}

export type HeaderContent = {
    type: "header",
    level: number,
    text: string
}

export type ImageContent = {
    type: "image",
    src: string | null,
    alt: string | null,
    caption: string | null
}

export type AnyContent = ParagraphContent | HeaderContent | ImageContent

export type Feed = {
    id: string,
    name: string,
    url: string,
    corsProxy: boolean,
    type: "rss" | "atom" | "rdf" | "json",
    category: "news" | "comics",
    scrape: boolean
}

export type Article = {
    source: Feed,
    time: string,
    title: string,
    desc: string,
    contents: AnyContent[],
    link: string,
}

const templateFeeds: Feed[] = [
    {
        id: "yle_main",
        name: "Yle main news",
        url: "https://yle.fi/rss/uutiset/paauutiset",
        corsProxy: true,
        type: "rss",
        category: "news",
        scrape: true
    },
    {
        id: "nyt",
        name: "New York Times",
        url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
        corsProxy: false,
        type: "rss",
        category: "news",
        scrape: false
    },
    {
        id: "hs",
        name: "HS Helsinki",
        url: "https://www.hs.fi/rss/tuoreimmat.xml",
        corsProxy: false,
        type: "rss",
        category: "news",
        scrape: true
    },
    {
        id: "xkcd",
        name: "xkcd",
        url: "https://xkcd.com/atom.xml",
        corsProxy: true,
        type: "atom",
        category: "comics",
        scrape: false
    }
]

let feeds: Feed[] = templateFeeds

async function getFeed(feed: Feed) {
    const text = await (await fetch(`${feed.corsProxy ? "https://cors-proxy.hekinav.dev/" : ""}${feed.url}`)).text()
    const data = parseFeed(text)
    return data
}

async function renderPaper() {
    const parsed: [Feed, AnyFeed][] = (await Promise.all(feeds.map(async f => ([f, await getFeed(f)]))))
    const combinedArticles: Article[] = (await Promise.all(parsed.map(p => parseArticles(p[0], p[1])))).flat().sort(() => Math.random() - 0.5)
    const html = combinedArticles.map(articleToHTML)
    document.body.innerHTML = `<section>${html.join("</section><section>")}</section>`
}

async function parseArticles(feed: Feed, feedData: AnyFeed): Promise<Article[]> {
    switch (feedData.format) {
        case "rss":
            return await Promise.all(feedData.feed.items?.slice(0,10).map<Promise<Article>>(async i => ({
                source: feed,
                time: i.pubDate || new Date().toISOString(),
                title: i.title || "",
                desc: i.description || "",
                contents: feed.scrape ? (await getContents(i.link || "", feed)).filter(a => a.type == "paragraph" ? a.text != i.description: true) : [],
                link: i.link || ""
            })) || [])
        case "atom":
            return await Promise.all(feedData.feed.entries?.slice(0,1).map<Promise<Article>>(async e => ({
                contents: feed.scrape ? (await getContents(e.links![0].href || "", feed)).filter(a => a.type == "paragraph" ? a.text != e.summary?.value: true) : [],
                desc: e.summary?.value || "",
                link: e.links![0].href || "",
                source: feed,
                time: e.updated || new Date().toISOString(),
                title: e.title?.value || ""
            })) || [])
        default:
            return []
    }
}

async function getContents(feedUrl: string, feed: Feed): Promise<AnyContent[]> {
    const text = await (await fetch(`${"https://cors-proxy.hekinav.dev/"}${feedUrl}`)).text()
    const html = new DOMParser().parseFromString(text, "text/html")
    const contents: AnyContent[] = []
    html.querySelectorAll(`
        article section
        :is(p:not(figcaption p${feed.id == "hs" ? ", .picture-fragment-container p" : ""}, aside p), 
        img${feed.id == "hs" ? ":not(.gap-nof-12.flex.flex-row.items-center.mb-nof-24 img)" : feed.id == "yle_main" ? ":not(a img)" : ""}, 
        figcaption, h2:not(aside h2), h3:not(aside h3), h4:not(aside h4))`).forEach((e, i, a) => {
        switch (e.tagName) {
            case "P":
                contents.push({type: "paragraph", text: e.textContent})
                break;
            case "IMG":
                contents.push({type: "image", src: (e as HTMLImageElement).src || null, alt: (e as HTMLImageElement).alt || null, caption: a[i+1] && a[i+1].tagName == "FIGCAPTION" ? a[i+1].textContent : null})
                break;
            case "H2":
                contents.push({type: "header", level: 2, text: e.textContent})
                break;
            case "H3":
                contents.push({type: "header", level: 3, text: e.textContent})
                break;
            case "H4":
                contents.push({type: "header", level: 4, text: e.textContent})
                break;
            case "FIGCAPTION":
                break;
            default:
                console.log(e.tagName)
                break;
        }
    })
    return contents
}

function articleToHTML(a: Article): string {
    let text = `
    <h1>${a.title}</h1>
    <p style="font-size: 1.5em;">${a.desc}</p>
    `
    a.contents.forEach(c => {
        switch (c.type) {
            case "paragraph":
                text += `<p>${c.text}</p>`
                break
            case "header":
                text += `<h${c.level}>${c.text}</h${c.level}>`
                break
            case "image":
                text += `<figure><img src="${c.src}" alt="${c.alt}">${c.caption ? `<figcaption>${c.caption}</figcaption>` : ""}</figure>`
                break
        }
    })
    return text
}


renderPaper()
