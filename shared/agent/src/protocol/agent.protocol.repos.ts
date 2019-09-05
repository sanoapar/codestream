"use strict";
import { RequestType } from "vscode-languageserver-protocol";
import { CSRepository } from "./api.protocol";

export interface CreateRepoRequest {
	url: string;
	knownCommitHashes: string[];
}

export interface CreateRepoResponse {
	repo: CSRepository;
}

export const CreateRepoRequestType = new RequestType<
	CreateRepoRequest,
	CreateRepoResponse,
	void,
	void
>("codestream/repos/create");

export interface FetchReposRequest {
	repoIds?: string[];
}

export interface FetchReposResponse {
	repos: CSRepository[];
}

export const FetchReposRequestType = new RequestType<
	FetchReposRequest,
	FetchReposResponse,
	void,
	void
>("codestream/repos");

export interface GetRepoRequest {
	repoId: string;
}

export interface GetRepoResponse {
	repo: CSRepository;
}

export const GetRepoRequestType = new RequestType<GetRepoRequest, GetRepoResponse, void, void>(
	"codestream/repo"
);

export interface RepoMap {
	path: string;
	repoId: string;
}

export interface MapReposRequest {
	repos: RepoMap[];
	skipRepositoryIntegration?: boolean | undefined;
}

export interface MapReposResponse {
	success?: boolean;
}

export const MapReposRequestType = new RequestType<MapReposRequest, MapReposResponse, void, void>(
	"codestream/repos/map"
);
