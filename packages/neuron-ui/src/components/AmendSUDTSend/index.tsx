import React, { useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { useState as useGlobalState, useDispatch, AppActions } from 'states'
import TextField from 'widgets/TextField'
import PageContainer from 'components/PageContainer'
import Button from 'widgets/Button'
import Spinner from 'widgets/Spinner'
import { GoBack } from 'widgets/Icons/icon'
import {
  isMainnet as isMainnetUtil,
  localNumberFormatter,
  useGoBack,
  scriptToAddress,
  shannonToCKBFormatter,
  sudtValueToAmount,
  sUDTAmountFormatter,
} from 'utils'
import { DEFAULT_SUDT_FIELDS } from 'utils/const'
import AlertDialog from 'widgets/AlertDialog'
import { useOutputs } from 'components/AmendPendingTransactionDialog/hooks'
import styles from './amendSUDTSend.module.scss'
import { useInitialize } from './hooks'

const AmendSUDTSend = () => {
  const {
    app: {
      loadings: { sending = false },
      showWaitForFullySynced,
    },
    wallet: { id: walletID = '', addresses },
    chain: { networkID },
    experimental,
    settings: { networks = [] },
    sUDTAccounts,
  } = useGlobalState()
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const { hash = '' } = useParams()

  const onBack = useGoBack()

  const isMainnet = isMainnetUtil(networks, networkID)

  const {
    fee,
    price,
    setPrice,
    transaction,
    onSubmit,
    minPrice,
    isConfirmedAlertShown,
    sudtInfo,
    description,
    onDescriptionChange,
    txValue,
  } = useInitialize({
    hash,
    walletID,
    isMainnet,
    dispatch,
    t,
  })

  const { items, lastOutputsCapacity } = useOutputs({
    transaction,
    isMainnet,
    addresses,
    sUDTAccounts,
    fee,
  })

  const priceError = useMemo(() => {
    return Number(price || '0') < Number(minPrice) ? t('price-switch.errorTip', { minPrice }) : null
  }, [price, minPrice])

  const inputHint = t('price-switch.hintTip', { suggestFeeRate: minPrice })

  const handlePriceChange = useCallback(
    (e: React.SyntheticEvent<HTMLInputElement>) => {
      const { value: inputValue } = e.currentTarget

      const value = inputValue.split('.')[0].replace(/[^\d]/g, '')
      setPrice(value)
    },
    [setPrice]
  )

  const toAddress = useMemo(() => {
    if (!transaction?.outputs) return ''

    const list = sUDTAccounts.map(item => item.address)

    const to = transaction?.outputs.find(output => {
      const address = scriptToAddress(output.lock, { isMainnet })
      if (list.includes(address) || (sudtInfo && !output.type)) {
        return false
      }
      return true
    })
    if (to) {
      return scriptToAddress(to.lock, { isMainnet })
    }
    return scriptToAddress(transaction?.outputs[0].lock, { isMainnet })
  }, [transaction?.outputs])

  useEffect(() => {
    if (transaction && lastOutputsCapacity !== undefined) {
      const outputs = items.map(item => {
        const capacity = item.isLastOutput ? lastOutputsCapacity.toString() : item.capacity
        return {
          ...item.output,
          capacity,
        }
      })
      dispatch({
        type: AppActions.UpdateExperimentalParams,
        payload: {
          tx: {
            ...transaction,
            description: experimental?.params?.description || description || '',
            outputs,
          },
        },
      })
    }
  }, [lastOutputsCapacity, transaction, items, dispatch, experimental?.params?.description, description])

  const disabled =
    sending || !experimental?.tx || priceError || lastOutputsCapacity === undefined || lastOutputsCapacity < 0

  return (
    <PageContainer
      head={
        <div className={styles.headerContainer}>
          <GoBack className={styles.goBack} onClick={onBack} />
          <p>{t('navbar.send')}</p>
        </div>
      }
    >
      <form onSubmit={onSubmit} data-wallet-id={walletID} data-status={disabled ? 'not-ready' : 'ready'}>
        <div className={`${styles.layout} ${showWaitForFullySynced ? styles.withFullySynced : ''}`}>
          <div className={styles.left}>
            <div className={styles.content}>
              <div className={styles.inputCell}>
                <div className={styles.addressCell}>
                  <div className={styles.label}>{t('send.address')}</div>
                  <div className={styles.content}>{toAddress}</div>
                </div>

                <TextField
                  className={styles.textFieldClass}
                  label={`${t('s-udt.send.amount')}(${sudtInfo?.sUDT.tokenName || 'CKB'})`}
                  field="amount"
                  value={sUDTAmountFormatter(
                    sudtValueToAmount(
                      (sudtInfo?.amount || txValue).replace('-', ''),
                      sudtInfo?.sUDT.decimal || DEFAULT_SUDT_FIELDS.CKBDecimal
                    )
                  )}
                  disabled
                  width="100%"
                />
              </div>
            </div>
          </div>

          <div className={styles.right}>
            <div className={styles.content}>
              <TextField
                placeholder={t('send.description-optional')}
                className={styles.textFieldClass}
                field="description"
                label={t('send.description')}
                value={description || experimental?.params?.description || ''}
                disabled={sending}
                onChange={onDescriptionChange}
                width="100%"
              />
              <TextField
                label={t('send.fee')}
                field="fee"
                value={`${shannonToCKBFormatter(fee.toString())} CKB`}
                readOnly
                disabled
                width="100%"
              />
              <TextField
                label={t('price-switch.customPrice')}
                field="price"
                value={localNumberFormatter(price)}
                onChange={handlePriceChange}
                suffix="shannons/kB"
                error={priceError}
                hint={!priceError && inputHint ? inputHint : null}
                width="100%"
              />
            </div>
            <div className={styles.rightFooter}>
              <div className={styles.actions}>
                <Button type="submit" disabled={disabled} label={t('send.send')}>
                  {sending ? <Spinner /> : (t('send.submit-transaction') as string)}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </form>
      <AlertDialog
        show={isConfirmedAlertShown}
        title={t('send.transaction-confirmed')}
        message={t('send.transaction-cannot-amend')}
        type="warning"
        onOk={onBack}
        action="ok"
      />
    </PageContainer>
  )
}

AmendSUDTSend.displayName = 'AmendSUDTSend'

export default AmendSUDTSend
