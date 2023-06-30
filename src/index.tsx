import * as React from 'react';
import { List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import axios from "axios";

const requestURL = new URL('https://xivapi.com/search');

type Opaque<B, T> = B & { _opaque: T };
type XivID = Opaque<number, 'XivID'>;
type XivHexID = Opaque<`0x${string}`, 'XivHexID'>;
type XivIconPath = Opaque<string, 'XivIcon'>;
type XivName = Opaque<string, 'XivName'>;
type XivURLPath = Opaque<string, 'XivURLPath'>;
type XivURLType = Opaque<string, 'XivURLType'>;
type XivSearchResponse = {
  Pagination: object,
  Results: {
    "ID": XivID,
    "Icon": XivIconPath,
    "Name": XivName,
    "Url": XivURLPath,
    "UrlType": XivURLType,
    "_": "enpcresident",
    "_Score": number
  }[],
}
type HrefString = Opaque<string, 'HrefString'>;

type MarkdownString = Opaque<string, 'MarkdownString'>;

const xivIdToString = (xivID: XivID): XivHexID => ['0x', xivID.toString(16).toUpperCase()].join('') as XivHexID;
const guessXivWikiURL = (name: XivName) => new URL(`https://ffxiv.consolegameswiki.com/wiki/${encodeURIComponent(name)}`);
const getMarkdownLink = (text: string, href: string) => `[${text}](${href})`;
const getItemMarkdown = (item: XivSearchResponse['Results'][number], data?: { wikiPageHref?: HrefString }): MarkdownString => {
  const { Name, ID, UrlType } = item;
  const { wikiPageHref } = data || {};
  return `# ${Name}
  

  | Key | Value |
  | --- | --- |
  | Type | ${UrlType} |
  | ID | ${xivIdToString(ID)} |
  
  ${[
      UrlType === 'Item' ? getMarkdownLink('Universalis', `https://universalis.app/market/${ID.toString(10)}`) : null,
      wikiPageHref !== undefined ? getMarkdownLink('Wiki', wikiPageHref) : null,
    ]
      .filter(item => item !== null)
      .map(link => ['-', link].join(' '))
      .join('\n')}` as MarkdownString;
}

export default function Command(arg: { arguments: { search: string } }) {
  const { data, isLoading } = useCachedPromise(async (url: URL, searchTerm: string) => {
    const searchURL = new URL(url);
    searchURL.searchParams.set('string', searchTerm);
    const response = await axios.get<XivSearchResponse>(searchURL.href);
    response.data.Results = response.data.Results.filter((item) => !item.Name.startsWith('Dated '));
    return response.data;
  }, [requestURL, arg.arguments.search],
  );
  const [selectedId, setSelectedId] = React.useState<XivHexID | null>(null);
  const selectedItem = React.useMemo(() => {
    if (selectedId === null || data === undefined) {
      return null;
    }
    return data.Results.find((possibleItem) => xivIdToString(possibleItem.ID) === selectedId) || null;
  }, [selectedId]);
  const { data: additionalData } = useCachedPromise(async (item: typeof selectedItem) => {
    if (item === null) {
      return undefined;
    }
    const wikiPageURL = guessXivWikiURL(item.Name);
    const doesWikipageExist = (await axios.options(wikiPageURL.href, {
      validateStatus: null,
    })).status === 200;
    return {
      currentItem: item,
      ...(doesWikipageExist && { wikiPageHref: wikiPageURL.href as HrefString }),
    }
  },
    [selectedItem]);

  console.log(additionalData);

  return (
    <List
      isShowingDetail
      isLoading={isLoading}
      onSelectionChange={(id) => {
        setSelectedId(id as XivHexID);
      }}
    >
      {data && data.Results.map((item) => {
        const { Name, UrlType, ID } = item;
        const markdown = additionalData?.currentItem.ID === item.ID ? getItemMarkdown(additionalData.currentItem, additionalData) : getItemMarkdown(item);
        return (
          <List.Item
            key={ID}
            id={xivIdToString(ID)}
            keywords={[
              UrlType, xivIdToString(ID),
            ]}
            title={Name}
            subtitle={UrlType}
            detail={<List.Item.Detail markdown={markdown} />}
          />
        );
      })}
    </List>
  )
}
