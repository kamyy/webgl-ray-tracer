import { Action } from 'redux'

import Scene from '../texture/Scene';

export enum ShadingMethod {
    FLAT, PHONG,
}

export enum SpinnerState {
    SHOW,
    HIDE,
    FAIL,
}

export enum ActionType {
    SET_SCENE = 'SET_SCENE',
    SET_LOAD_STATUS = 'SET_LOAD_STATUS',
    SET_NUM_SAMPLES = 'SET_NUM_SAMPLES',
    SET_NUM_BOUNCES = 'SET_NUM_BOUNCES',
    SET_CAMERA_FOV  = 'SET_CAMERA_FOV',
    SET_SHADING_METHOD = 'SET_SHADING_METHOD',
    SET_RENDERING_PASS = 'SET_RENDERING_PASS',
    SET_ELAPSED_TIME = 'SET_ELAPSED_TIME',
    SET_ETA_TIME = 'SET_ETA_TIME',
    SET_AVG_TIME = 'SET_AVG_TIME',
}

export interface ISceneAction extends Action {
    type: ActionType;
    scene: Scene;
}

export interface ILoadStatusAction extends Action {
    type: ActionType;
    loadStatus: number;
}

export interface INumSamplesAction extends Action {
    type: ActionType;
    numSamples: number;
}

export interface INumBouncesAction extends Action {
    type: ActionType;
    numBounces: number;
}

export interface ICameraFovAction extends Action {
    type: ActionType;
    cameraFov: number;
}

export interface IShadingMethodAction extends Action {
    type: ActionType;
    shadingMethod: number;
}

export interface IRenderingPassAction extends Action {
    type: ActionType;
    renderingPass: number;
}

export interface IElapsedTimeAction extends Action {
    type: ActionType;
    elapsedTime: string;
}

export interface IEtaTimeAction extends Action {
    type: ActionType;
    etaTime: string;
}

export interface IAvgTimeAction extends Action {
    type: ActionType;
    avgTime: string;
}

export function setScene(scene: Scene): ISceneAction {
    return { type: ActionType.SET_SCENE, scene };
}

export function setLoadStatus(loadStatus: number): ILoadStatusAction {
    return { type: ActionType.SET_LOAD_STATUS, loadStatus };
}

export function setNumSamples(numSamples: number): INumSamplesAction {
    return { type: ActionType.SET_NUM_SAMPLES, numSamples };
}

export function setNumBounces(numBounces: number): INumBouncesAction {
    return { type: ActionType.SET_NUM_BOUNCES, numBounces };
}

export function setCameraFov(cameraFov: number): ICameraFovAction {
    return { type: ActionType.SET_CAMERA_FOV, cameraFov };
}

export function setShadingMethod(shadingMethod: number): IShadingMethodAction {
    return { type: ActionType.SET_SHADING_METHOD, shadingMethod };
}

export function setRenderingPass(renderingPass: number): IRenderingPassAction {
    return { type: ActionType.SET_RENDERING_PASS, renderingPass };
}

export function setElapsedTime(elapsedTime: string): IElapsedTimeAction {
    return { type: ActionType.SET_ELAPSED_TIME, elapsedTime };
}

export function setEtaTime(etaTime: string): IEtaTimeAction {
    return { type: ActionType.SET_ETA_TIME, etaTime };
}

export function setAvgTime(avgTime: string): IAvgTimeAction {
    return { type: ActionType.SET_AVG_TIME, avgTime };
}
