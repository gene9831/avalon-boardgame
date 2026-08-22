import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

import {
  createAvalonReplayArtifact,
  replayAvalonArtifact,
  type AvalonReplayArtifact,
} from './artifact'
import { playGeneratedGame } from './generated-game'

export type ReplayCliOptions =
  | { mode: 'artifact'; path: string }
  | { mode: 'generate'; masterSeed: string; playerCount: number }

function readFlag(args: readonly string[], flag: string) {
  const index = args.indexOf(flag)
  return index === -1 ? undefined : args[index + 1]
}

export function parseReplayCliArgs(args: readonly string[]): ReplayCliOptions {
  const path = readFlag(args, '--file')
  if (path !== undefined) return { mode: 'artifact', path }

  const masterSeed = readFlag(args, '--seed')
  const playerCount = Number(readFlag(args, '--players'))
  if (masterSeed === undefined || masterSeed.length === 0) {
    throw new Error('Replay requires --file or --seed with --players')
  }
  if (!Number.isInteger(playerCount) || playerCount < 5 || playerCount > 10) {
    throw new Error('Player count must be an integer from 5 to 10')
  }

  return { mode: 'generate', masterSeed, playerCount }
}

export async function runReplayCli(args: readonly string[]) {
  const options = parseReplayCliArgs(args)
  let artifact: AvalonReplayArtifact

  if (options.mode === 'artifact') {
    artifact = JSON.parse(
      await readFile(options.path, 'utf8'),
    ) as AvalonReplayArtifact
  } else {
    const generated = playGeneratedGame(options)
    artifact = createAvalonReplayArtifact({
      codeVersion: process.env.GITHUB_SHA ?? 'working-tree',
      masterSeed: options.masterSeed,
      playerCount: options.playerCount,
      transcript: generated.transcript,
    })
  }

  const state = await replayAvalonArtifact(artifact)
  console.log(JSON.stringify({
    codeVersion: artifact.codeVersion,
    masterSeed: artifact.masterSeed,
    playerCount: artifact.playerCount,
    result: state.G.result,
    status: state.G.status,
    transcriptLength: artifact.transcript.length,
  }))
}

const entryPoint = process.argv[1]
if (
  entryPoint !== undefined &&
  import.meta.url === pathToFileURL(entryPoint).href
) {
  runReplayCli(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
